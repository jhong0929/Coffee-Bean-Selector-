import { Order, BeanWish, CoffeeBean } from '../types';

export const DEFAULT_SPREADSHEET_TITLE = '咖啡豆選擇平台 (訂單與許願池)';

export const BEAN_LIST_COLUMNS = [
  'bean_id',
  'name',
  'origin',
  'process',
  'roast_level',
  'flavor_notes',
  'status',
];

export const INITIAL_BEAN_LIST_ROWS = [
  ['bean_1', '耶加雪菲 潔蒂普 G1', '衣索比亞', '水洗', '淺焙', '檸檬柑橘、茉莉花香、伯爵茶韻', '啟用'],
  ['bean_2', '西達摩 桃可可 G1', '衣索比亞', '日曬', '淺中焙', '水蜜桃、成熟莓果、熱帶水果酒香', '啟用'],
  ['bean_3', '考卡 天堂莊園 雙重發酵', '哥倫比亞', '水洗', '中焙', '焦糖布丁、烤堅果、青蘋果酸', '啟用'],
  ['bean_4', '波奎特 翡翠莊園 綠標', '巴拿馬', '蜜處理', '淺焙', '野蜂蜜、白桃果乾、高山烏龍', '啟用'],
  ['bean_5', '迦佑山脈 皇冠曼特寧', '印尼', '濕剝處理', '中深焙', '85% 黑巧克力、雪松木質、甘草草本', '啟用'],
  ['bean_6', '涅里 祈安布 AA', '肯亞', '水洗', '淺中焙', '黑醋栗、番茄梅、烏梅汁甘醇', '啟用'],
  ['bean_7', '塔拉珠 音樂家 巴哈', '哥斯大黎加', '厭氧發酵', '淺中焙', '葡萄乾、蘭姆酒、黑櫻桃果醬', '啟用'],
  ['bean_8', '喜拉朵 摩吉安娜 紅波旁', '巴西', '日曬', '中深焙', '烘烤杏仁、牛奶巧克力、香草', '啟用'],
];

export const ORDERS_COLUMNS = [
  'order_id',
  'created_at',
  'bean_name',
  'origin',
  'process',
  'brew_method',
  'temperature',
  'quantity',
  'note',
  'selection_mode',
  'status',
];

export const WISH_COLUMNS = [
  'wish_id',
  'created_at',
  'origin',
  'process',
  'other_process',
  'status',
];

interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
}

/**
 * 尋找現有的咖啡豆試算表，若不存在則自動於使用者的 Google Drive 建立
 */
export async function findOrCreateSpreadsheet(accessToken: string): Promise<SpreadsheetInfo> {
  // 1. 先從 Google Drive 搜尋同名試算表
  try {
    const query = encodeURIComponent(
      `name = '${DEFAULT_SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const file = data.files[0];
        // 確保 BeanList、Orders 和 BeanWishList 工作表存在
        await ensureSheetsExist(accessToken, file.id);
        return {
          id: file.id,
          title: file.name,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
        };
      }
    }
  } catch (err) {
    console.warn('搜尋既有試算表時發生非致命提示，將嘗試直接建立:', err);
  }

  // 2. 若無則自動建立全新試算表
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: DEFAULT_SPREADSHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: 'BeanList',
            gridProperties: { rowCount: 100, columnCount: 10 },
          },
        },
        {
          properties: {
            title: 'Orders',
            gridProperties: { rowCount: 100, columnCount: 15 },
          },
        },
        {
          properties: {
            title: 'BeanWishList',
            gridProperties: { rowCount: 100, columnCount: 10 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`建立 Google 試算表失敗 (${createRes.status}): ${errorBody}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;

  // 3. 寫入標題列 (Headers) 與初始豆單
  await initializeSheetHeaders(accessToken, spreadsheetId, true);

  return {
    id: spreadsheetId,
    title: DEFAULT_SPREADSHEET_TITLE,
    url: createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * 確保 BeanList、Orders 與 BeanWishList 工作表均存在並含有標題列
 */
export async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    throw new Error(`讀取試算表資訊失敗: ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const sheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title);

  const requests: any[] = [];
  if (!sheetTitles.includes('BeanList')) {
    requests.push({ addSheet: { properties: { title: 'BeanList', index: 0 } } });
  }
  if (!sheetTitles.includes('Orders')) {
    requests.push({ addSheet: { properties: { title: 'Orders' } } });
  }
  if (!sheetTitles.includes('BeanWishList')) {
    requests.push({ addSheet: { properties: { title: 'BeanWishList' } } });
  }

  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }

  // 檢查並補齊標題列及初始豆單
  await initializeSheetHeaders(accessToken, spreadsheetId, false);
}

/**
 * 初始化標題列與 BeanList 初始種子資料
 */
async function initializeSheetHeaders(accessToken: string, spreadsheetId: string, isNewlyCreated = false) {
  const dataPayload: any[] = [];

  if (isNewlyCreated) {
    // 新建試算表，直接寫入所有標題列與初始豆單
    dataPayload.push(
      {
        range: 'BeanList!A1:G9',
        values: [BEAN_LIST_COLUMNS, ...INITIAL_BEAN_LIST_ROWS],
      },
      {
        range: 'Orders!A1:K1',
        values: [ORDERS_COLUMNS],
      },
      {
        range: 'BeanWishList!A1:F1',
        values: [WISH_COLUMNS],
      }
    );
  } else {
    // 既有試算表：逐一檢查標題列與 BeanList 資料行
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=BeanList!A1:G2&ranges=Orders!A1:K1&ranges=BeanWishList!A1:F1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (checkRes.ok) {
        const valData = await checkRes.json();
        const beanRows = valData.valueRanges?.[0]?.values;
        const ordersRows = valData.valueRanges?.[1]?.values;
        const wishRows = valData.valueRanges?.[2]?.values;

        // 如果 BeanList 是空的，補上標題與種子資料
        if (!beanRows || beanRows.length === 0) {
          dataPayload.push({
            range: 'BeanList!A1:G9',
            values: [BEAN_LIST_COLUMNS, ...INITIAL_BEAN_LIST_ROWS],
          });
        }

        if (!ordersRows || ordersRows.length === 0) {
          dataPayload.push({
            range: 'Orders!A1:K1',
            values: [ORDERS_COLUMNS],
          });
        }

        if (!wishRows || wishRows.length === 0) {
          dataPayload.push({
            range: 'BeanWishList!A1:F1',
            values: [WISH_COLUMNS],
          });
        }
      }
    } catch (err) {
      console.warn('檢查工作表標題列時發生提示:', err);
    }
  }

  if (dataPayload.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataPayload,
      }),
    });
  }
}

/**
 * 從 Google Sheets 的「BeanList」工作表強制讀取咖啡豆清單
 */
export async function fetchBeansFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<CoffeeBean[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/BeanList!A1:G100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`從 Google Sheets 讀取 BeanList 失敗 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  if (rows.length <= 1) {
    return [];
  }

  // 首列為標題
  const headerRow = rows[0].map((h) => (h || '').toString().trim().toLowerCase());

  // 尋找各欄位索引
  const idIdx = headerRow.findIndex((h) => h.includes('id'));
  const nameIdx = headerRow.findIndex((h) => h.includes('name') || h.includes('豆') || h.includes('名稱'));
  const originIdx = headerRow.findIndex((h) => h.includes('origin') || h.includes('產地'));
  const processIdx = headerRow.findIndex((h) => h.includes('process') || h.includes('處理'));
  const roastIdx = headerRow.findIndex((h) => h.includes('roast') || h.includes('焙'));
  const flavorIdx = headerRow.findIndex((h) => h.includes('flavor') || h.includes('風味'));
  const statusIdx = headerRow.findIndex((h) => h.includes('status') || h.includes('狀態'));

  const parsedBeans: CoffeeBean[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawName = (nameIdx >= 0 && row[nameIdx]) ? row[nameIdx].trim() : (row[1] || '').trim();
    if (!rawName) continue; // 沒有豆名則略過

    const rawStatus = (statusIdx >= 0 && row[statusIdx]) ? row[statusIdx].trim().toLowerCase() : (row[6] || '').trim().toLowerCase();
    // 排除停用狀態
    if (rawStatus === '停用' || rawStatus === '下架' || rawStatus === 'disabled' || rawStatus === 'inactive') {
      continue;
    }

    const rawId = (idIdx >= 0 && row[idIdx]) ? row[idIdx].trim() : (row[0] || `bean_${i}`).trim();
    const rawOrigin = (originIdx >= 0 && row[originIdx]) ? row[originIdx].trim() : (row[2] || '單一產區').trim();
    const rawProcess = (processIdx >= 0 && row[processIdx]) ? row[processIdx].trim() : (row[3] || '水洗').trim();
    const rawRoast = (roastIdx >= 0 && row[roastIdx]) ? row[roastIdx].trim() : (row[4] || '').trim();
    const rawFlavors = (flavorIdx >= 0 && row[flavorIdx]) ? row[flavorIdx].trim() : (row[5] || '').trim();

    const flavorNotes = rawFlavors
      ? rawFlavors.split(/[、,，;；/|\s]+/).map((f) => f.trim()).filter(Boolean)
      : [];

    parsedBeans.push({
      id: rawId || `bean_${i}`,
      name: rawName,
      origin: rawOrigin || '單一產地',
      process: rawProcess || '水洗',
      roastLevel: rawRoast || undefined,
      flavorNotes: flavorNotes.length > 0 ? flavorNotes : undefined,
      isDemo: false,
    });
  }

  return parsedBeans;
}

/**
 * 將訂單寫入 Google Sheets 工作表「Orders」
 */
export async function appendOrderToSheet(
  accessToken: string,
  spreadsheetId: string,
  order: Order
): Promise<{ success: boolean; updatedRange?: string }> {
  const rowValues = [
    order.orderId,
    order.createdAt,
    order.beanName,
    order.origin,
    order.process,
    order.brewMethod,
    order.temperature,
    order.quantity,
    order.note || '',
    order.selectionMode,
    order.status,
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = `寫入 Google Sheets 失敗 (${res.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // use raw
    }
    throw new Error(message);
  }

  const result = await res.json();
  return {
    success: true,
    updatedRange: result.updates?.updatedRange,
  };
}

/**
 * 將許願資料寫入 Google Sheets 工作表「BeanWishList」
 */
export async function appendWishToSheet(
  accessToken: string,
  spreadsheetId: string,
  wish: BeanWish
): Promise<{ success: boolean; updatedRange?: string }> {
  const rowValues = [
    wish.wishId,
    wish.createdAt,
    wish.origin,
    wish.process,
    wish.otherProcess || '',
    wish.status,
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/BeanWishList!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = `寫入許願池記錄失敗 (${res.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // use raw
    }
    throw new Error(message);
  }

  const result = await res.json();
  return {
    success: true,
    updatedRange: result.updates?.updatedRange,
  };
}
