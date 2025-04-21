/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "@azure/storage-blob",
      "pdfkit",
      "exceljs",
      "pptxgenjs",
      "csv-stringify",
      "memory-streams"
    ],
  },
};

module.exports = nextConfig;
