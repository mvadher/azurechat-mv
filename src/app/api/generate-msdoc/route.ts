import { AI_NAME } from "@/features/theme/theme-config";
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Document, Packer, Paragraph, TextRun } from "docx";
import "isomorphic-fetch";
import { stringify } from "csv-stringify/sync";
import { WritableStream } from "memory-streams";
import { PassThrough } from "stream";
import path from "path";
import PDFDocument from "pdfkit";

// Using Roboto font for PDF generation
const fontPath = path.join(process.cwd(), "src/fonts/Roboto/static/Roboto-Regular.ttf");

export async function POST(req: NextRequest) {
  let { filename, content, format = "docx" } = await req.json();
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;
  filename = `${timestamp}-${filename}`;

  if (!filename || !content) {
    return NextResponse.json({ error: "Missing filename or content" }, { status: 400 });
  }

  try {
    const msalConfig = {
      auth: {
        clientId: process.env.MS_GRAPH_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
        clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!,
      },
    };
    console.log("📢 ENV CHECK");
    console.log("CLIENT_ID:", process.env.MS_GRAPH_CLIENT_ID);
    console.log("TENANT_ID:", process.env.MS_GRAPH_TENANT_ID);

    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    const accessToken = tokenResponse?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "Failed to acquire token" }, { status: 401 });
    }

    let buffer: Buffer;
    let extension = format;
    if (format === "docx") {
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ children: [new TextRun({ text: filename, bold: true, size: 28 })] }),
              new Paragraph({ children: [new TextRun(content)] }),
            ],
          },
        ],
      });
      buffer = await Packer.toBuffer(doc);
    } else if (format === "csv") {
      const csvData = Array.isArray(content) ? content : [[content]];
      buffer = Buffer.from(stringify(csvData), "utf-8");
    } else if (format === "xlsx") {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sheet 1");
      const rows = Array.isArray(content) ? content : [[content]];
      worksheet.addRows(rows);
      buffer = await workbook.xlsx.writeBuffer();
    } else if (format === "pptx") {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText(typeof content === "string" ? content : JSON.stringify(content), {
        x: 1,
        y: 1,
        fontSize: 18,
        color: "363636",
      });
      buffer = await pptx.write("arraybuffer").then((b) => Buffer.from(b));
    } else if (format === "pdf") {
      buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          size: "A4",
          margin: 50,
          font: fontPath,
        });
        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);

        doc.pipe(stream);
        doc.fontSize(12).text(typeof content === "string" ? content : JSON.stringify(content));
        doc.end();
      });
    } else {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
    }

    const graphClient = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    const drives = await graphClient.api('/drives').get();
    const driveId = drives.value[0]?.id;

    if (!driveId) {
      return NextResponse.json({ error: "Drive ID not found" }, { status: 500 });
    }

    const uploadResponse = await graphClient
      .api(`/drives/${driveId}/root:/${filename}.${extension}:/content`)
      .put(buffer);

    return NextResponse.json({
      message: "File created in OneDrive",
      fileUrl: uploadResponse.webUrl,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
