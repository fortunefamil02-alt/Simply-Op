import axios, { AxiosInstance } from "axios";
import { ENV } from "../env";
import { OAuthService } from "./OAuthService";

const AXIOS_TIMEOUT_MS = 10_000;

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  getAuthorizationUrl(redirectUri: string) {
    if (!ENV.oAuthServerUrl) {
      throw new Error("OAUTH_SERVER_URL not configured");
    }

    const state = Buffer.from(redirectUri).toString("base64");

    const params = new URLSearchParams({
      client_id: ENV.appId,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });

    return {
      url: `${ENV.oAuthServerUrl}/oauth/authorize?${params.toString()}`,
    };
  }

  async exchangeCodeForToken(code: string, state: string) {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string) {
    return this.oauthService.getUserInfoByToken({ accessToken } as any);
  }
}

export const sdk = new SDKServer();
          
