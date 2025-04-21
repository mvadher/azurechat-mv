import { ExtensionUIConfig } from "../extension-services/types";

const googleSearchConfig: ExtensionUIConfig = {
  namespace: "GoogleSearch",
  friendlyName: "Google Search",
  description: "Search the web using Google Programmable Search",
  inputs: [
    {
      key: "GOOGLE_SEARCH_API_KEY",
      label: "API Key",
      type: "password",
    },
    {
      key: "GOOGLE_CSE_ID",
      label: "Search Engine ID (CX)",
      type: "text",
    },
  ],
};

export default googleSearchConfig;
