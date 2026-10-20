import firebaseConfig from '../../firebase-applet-config.json';

// 使用者資訊型別
export interface AuthUser {
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

// 請求之 Google Workspace 授權範圍 (Google Sheets & Google Drive)
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

// 記憶體中暫存 Access Token (嚴格遵循安全準則，絕不存放於 localStorage)
let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;
let authListener: ((user: AuthUser | null, token: string | null) => void) | null = null;

/**
 * 取得 OAuth Client ID (公開客戶端識別碼，非 API KEY)
 */
export const getOAuthClientId = (): string => {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    firebaseConfig.oAuthClientId ||
    ''
  );
};

/**
 * 初始化授權狀態監聽
 */
export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  authListener = (user, token) => {
    if (user && token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  };

  // 若當前記憶體已有快取狀態則觸發
  if (cachedUser && cachedAccessToken) {
    if (onAuthSuccess) onAuthSuccess(cachedUser, cachedAccessToken);
  }

  return () => {
    authListener = null;
  };
};

/**
 * 載入 Google Identity Services SDK (GIS)
 */
function waitForGoogleAccounts(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve((window as any).google.accounts.oauth2);
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve((window as any).google.accounts.oauth2);
      } else if (attempts > 50) {
        clearInterval(interval);
        reject(new Error('Google Identity Services (GIS) 載入超時，請檢查網路連線'));
      }
    }, 100);
  });
}

/**
 * 觸發 Google OAuth 授權（純前端授權流程，無需任何 API KEY）
 */
export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  const clientId = getOAuthClientId();
  if (!clientId) {
    throw new Error('未設定 Google OAuth Client ID');
  }

  const oauth2 = await waitForGoogleAccounts();

  return new Promise((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        prompt: 'consent',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google 授權失敗:', tokenResponse);
            reject(new Error(`Google 授權失敗: ${tokenResponse.error_description || tokenResponse.error}`));
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            reject(new Error('未能自授權流程取得存取憑證 (Access Token)'));
            return;
          }

          cachedAccessToken = accessToken;

          // 取得授權之使用者基本資料
          let userInfo: AuthUser = {
            email: null,
            displayName: null,
          };

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              userInfo = {
                email: uData.email || null,
                displayName: uData.name || null,
                photoURL: uData.picture || null,
              };
            }
          } catch (e) {
            console.warn('取得使用者基本資料提示:', e);
          }

          cachedUser = userInfo;

          if (authListener) {
            authListener(userInfo, accessToken);
          }

          resolve({ user: userInfo, accessToken });
        },
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * 取得當前存於記憶體中的 Access Token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * 手動設定記憶體 Access Token
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * 登出 Google 授權並清除記憶體憑證
 */
export const logoutAuth = async () => {
  if (cachedAccessToken && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      (window as any).google.accounts.oauth2.revoke(cachedAccessToken, () => {
        // revoked
      });
    } catch {
      // ignore revoke error
    }
  }

  cachedAccessToken = null;
  cachedUser = null;

  if (authListener) {
    authListener(null, null);
  }
};
