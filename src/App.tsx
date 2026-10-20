/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CoffeeBean, BrewMethod, Temperature, SelectionMode, Order, BeanWish, SheetConnectionState } from './types';
import { INITIAL_BEANS } from './data/initialBeans';
import { Header } from './components/Header';
import { BeanWheel } from './components/BeanWheel';
import { ManualBeanList } from './components/ManualBeanList';
import { BrewSettings } from './components/BrewSettings';
import { OrderSummary } from './components/OrderSummary';
import { WishPool } from './components/WishPool';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logoutAuth,
  setCachedAccessToken,
} from './services/firebaseAuth';
import {
  findOrCreateSpreadsheet,
  fetchBeansFromSheet,
  appendOrderToSheet,
  appendWishToSheet,
  DEFAULT_SPREADSHEET_TITLE,
} from './services/googleSheets';
import { Dices, ListFilter, Sparkles, Coffee, RefreshCw, FileSpreadsheet, LogIn } from 'lucide-react';

const SPREADSHEET_STORAGE_KEY = 'coffee_bean_selector_sheet_id';
const SPREADSHEET_URL_STORAGE_KEY = 'coffee_bean_selector_sheet_url';

export default function App() {
  // 咖啡豆清單管理：強制以 Google Sheets 中的「BeanList」資料表為來源
  const [beans, setBeans] = useState<CoffeeBean[]>(INITIAL_BEANS);
  const [isRefreshingBeans, setIsRefreshingBeans] = useState<boolean>(false);
  // 每次訂單預設選擇一款咖啡豆（切換模式保留）
  const [selectedBean, setSelectedBean] = useState<CoffeeBean | null>(INITIAL_BEANS[0]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('random');

  // 飲品製作設定
  const [brewMethod, setBrewMethod] = useState<BrewMethod>('手沖');
  const [temperature, setTemperature] = useState<Temperature>('熱');
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  // Google Sheets 連線狀態
  const [sheetState, setSheetState] = useState<SheetConnectionState>({
    isConnected: false,
    userEmail: null,
    spreadsheetId: localStorage.getItem(SPREADSHEET_STORAGE_KEY),
    spreadsheetTitle: DEFAULT_SPREADSHEET_TITLE,
    spreadsheetUrl: localStorage.getItem(SPREADSHEET_URL_STORAGE_KEY),
    isLoading: false,
    error: null,
  });

  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);

  // 初始化 Firebase Auth 狀態監聽
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        if (token) {
          setCachedAccessToken(token);
          // 若已有 token，自動探測或建立試算表並讀取 BeanList 豆單
          await syncSpreadsheetWithToken(token, user.email || null);
        } else {
          // 有 Firebase 登入狀態但暫時無記憶體 token (需由使用者點擊 Google Sign-in 更新)
          setSheetState((prev) => ({
            ...prev,
            userEmail: user.email || null,
          }));
        }
      },
      () => {
        setSheetState((prev) => ({
          ...prev,
          isConnected: false,
          userEmail: null,
        }));
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // 透過 Token 同步或建立 Google 試算表，並強制讀取 BeanList 工作表為豆單來源
  const syncSpreadsheetWithToken = async (token: string, email: string | null) => {
    setSheetState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const sheetInfo = await findOrCreateSpreadsheet(token);
      localStorage.setItem(SPREADSHEET_STORAGE_KEY, sheetInfo.id);
      localStorage.setItem(SPREADSHEET_URL_STORAGE_KEY, sheetInfo.url);

      setSheetState({
        isConnected: true,
        userEmail: email,
        spreadsheetId: sheetInfo.id,
        spreadsheetTitle: sheetInfo.title,
        spreadsheetUrl: sheetInfo.url,
        isLoading: false,
        error: null,
      });

      // 強制讀取 Google Sheets 的 BeanList 資料表
      await loadBeansFromSheetId(token, sheetInfo.id);
    } catch (err: any) {
      console.error('同步試算表失敗:', err);
      setSheetState((prev) => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err?.message || '建立或讀取試算表失敗',
      }));
    }
  };

  // 從 Google Sheets 的「BeanList」資料表讀取最新咖啡豆清單
  const loadBeansFromSheetId = async (token: string, sheetId: string) => {
    setIsRefreshingBeans(true);
    try {
      const sheetBeans = await fetchBeansFromSheet(token, sheetId);
      if (sheetBeans && sheetBeans.length > 0) {
        setBeans(sheetBeans);
        // 保留使用者當前已選取之豆種（若在新豆單內）
        setSelectedBean((prev) => {
          if (!prev) return sheetBeans[0];
          const matched = sheetBeans.find((b) => b.id === prev.id || b.name === prev.name);
          return matched || sheetBeans[0];
        });
      }
    } catch (err) {
      console.warn('從 BeanList 讀取豆單時發生提示:', err);
    } finally {
      setIsRefreshingBeans(false);
    }
  };

  // 點擊 Google 登入授權
  const handleConnectGoogle = async () => {
    setSheetState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const authResult = await googleSignIn();
      if (authResult?.accessToken) {
        await syncSpreadsheetWithToken(authResult.accessToken, authResult.user.email || null);
      }
    } catch (err: any) {
      console.error('Google 授權登入失敗:', err);
      setSheetState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Google 授權登入取消或失敗',
      }));
    }
  };

  // 登出 Google
  const handleDisconnectGoogle = async () => {
    await logoutAuth();
    setSheetState({
      isConnected: false,
      userEmail: null,
      spreadsheetId: null,
      spreadsheetTitle: null,
      spreadsheetUrl: null,
      isLoading: false,
      error: null,
    });
    localStorage.removeItem(SPREADSHEET_STORAGE_KEY);
    localStorage.removeItem(SPREADSHEET_URL_STORAGE_KEY);
  };

  // 重新從 BeanList 同步咖啡豆
  const handleRefreshBeans = async () => {
    const token = await getAccessToken();
    const currentSheetId = sheetState.spreadsheetId || localStorage.getItem(SPREADSHEET_STORAGE_KEY);
    if (!token || !currentSheetId) {
      await handleConnectGoogle();
      return;
    }
    await loadBeansFromSheetId(token, currentSheetId);
  };

  // 重新同步既有試算表與工作表
  const handleRefreshSpreadsheet = async () => {
    const token = await getAccessToken();
    if (!token) {
      await handleConnectGoogle();
      return;
    }
    await syncSpreadsheetWithToken(token, sheetState.userEmail);
  };

  // 提交訂單
  const handleOrderSubmit = async (order: Order): Promise<boolean> => {
    let token = await getAccessToken();
    if (!token) {
      const authResult = await googleSignIn();
      if (!authResult?.accessToken) {
        throw new Error('未取得授權，請登入 Google 帳號後重新送出');
      }
      token = authResult.accessToken;
      await syncSpreadsheetWithToken(token, authResult.user.email || null);
    }

    const currentSheetId = sheetState.spreadsheetId || localStorage.getItem(SPREADSHEET_STORAGE_KEY);
    if (!currentSheetId) {
      throw new Error('找不到可寫入的試算表 ID，請點擊上方重新連線');
    }

    await appendOrderToSheet(token, currentSheetId, order);
    return true;
  };

  // 提交許願
  const handleWishSubmit = async (wish: BeanWish): Promise<boolean> => {
    let token = await getAccessToken();
    if (!token) {
      const authResult = await googleSignIn();
      if (!authResult?.accessToken) {
        throw new Error('未取得授權，請登入 Google 帳號後重新送出');
      }
      token = authResult.accessToken;
      await syncSpreadsheetWithToken(token, authResult.user.email || null);
    }

    const currentSheetId = sheetState.spreadsheetId || localStorage.getItem(SPREADSHEET_STORAGE_KEY);
    if (!currentSheetId) {
      throw new Error('找不到可寫入的試算表 ID，請點擊上方重新連線');
    }

    await appendWishToSheet(token, currentSheetId, wish);
    return true;
  };

  // 重置飲品製作（再點一杯）
  const handleResetOrder = () => {
    setBrewMethod('手沖');
    setTemperature('熱');
    setQuantity(1);
    setNote('');
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col font-sans selection:bg-[#E2D5C3] selection:text-[#2C221E]">
      {/* 頁首 */}
      <Header
        sheetState={sheetState}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        onConnectGoogle={handleConnectGoogle}
      />

      {/* 主內容區塊 */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* B. 咖啡豆選擇區 */}
        <section className="bg-[#FAF7F2] border border-[#E6DCB8] rounded-3xl p-5 sm:p-7 shadow-2xs">
          {/* 頂部來源與切換列 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-3 border-b border-[#EAE0D0] gap-3">
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-[#2B1B13] flex items-center gap-2">
                <span>選擇今日咖啡豆</span>
                <span className="text-xs font-normal font-sans text-[#8C6D58] bg-[#EFE7DA] px-2.5 py-0.5 rounded-full">
                  單一豆種訂製
                </span>
              </h2>
              <p className="text-xs text-[#7B6656] mt-0.5">
                切換轉盤抽選或手動自選，已選咖啡豆將為您完整保留
              </p>
            </div>

            {/* 模式切換器 (隨機轉盤 / 手動選豆) */}
            <div className="flex bg-[#EFE7DA] p-1 rounded-full border border-[#D9CDBA] self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setSelectionMode('random')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectionMode === 'random'
                    ? 'bg-[#4A3225] text-[#FAF6F0] shadow-xs'
                    : 'text-[#6C5648] hover:text-[#2C1D15]'
                }`}
              >
                <Dices className="w-3.5 h-3.5" />
                <span>隨機轉盤</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('manual')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectionMode === 'manual'
                    ? 'bg-[#4A3225] text-[#FAF6F0] shadow-xs'
                    : 'text-[#6C5648] hover:text-[#2C1D15]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>手動選豆</span>
              </button>
            </div>
          </div>

          {/* 強制讀取 Google Sheets BeanList 資料來源指示條 */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#F2ECE1] border border-[#DDD3C1] rounded-xl text-xs text-[#4F3C31]">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C5E3C]" />
              <span>
                轉盤資料來源：Google Sheets <strong>BeanList</strong> 工作表
              </span>
              {sheetState.isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  已載入 {beans.length} 款啟用豆種
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md font-medium">
                  未連線試算表 (使用初始種子)
                </span>
              )}
            </div>

            {sheetState.isConnected ? (
              <button
                type="button"
                onClick={handleRefreshBeans}
                disabled={isRefreshingBeans}
                className="inline-flex items-center gap-1 text-xs text-[#7A5B45] hover:text-[#3B281B] font-medium underline underline-offset-2 transition-colors cursor-pointer"
                title="若您在 Google Sheets 修改了豆單，點此立即重新整理"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingBeans ? 'animate-spin' : ''}`} />
                <span>{isRefreshingBeans ? '讀取 BeanList 中...' : '重新讀取 BeanList'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-1 text-xs text-[#8C5E3C] hover:text-[#4A3225] font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                <span>連線以讀取雲端 BeanList</span>
              </button>
            )}
          </div>

          {/* 模式內容 */}
          {selectionMode === 'random' ? (
            <BeanWheel
              beans={beans}
              selectedBean={selectedBean}
              onSelectBean={(bean) => setSelectedBean(bean)}
            />
          ) : (
            <ManualBeanList
              beans={beans}
              selectedBean={selectedBean}
              onSelectBean={(bean) => setSelectedBean(bean)}
            />
          )}
        </section>

        {/* C. 飲品製作設定區 */}
        <section>
          <BrewSettings
            brewMethod={brewMethod}
            onChangeBrewMethod={setBrewMethod}
            temperature={temperature}
            onChangeTemperature={setTemperature}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            note={note}
            onChangeNote={setNote}
          />
        </section>

        {/* D. 訂單確認區 */}
        <section>
          <OrderSummary
            selectedBean={selectedBean}
            brewMethod={brewMethod}
            temperature={temperature}
            quantity={quantity}
            note={note}
            selectionMode={selectionMode}
            sheetState={sheetState}
            onConnectGoogle={handleConnectGoogle}
            onSubmitOrder={handleOrderSubmit}
            onResetOrder={handleResetOrder}
          />
        </section>

        {/* E. 豆子許願池 */}
        <WishPool
          sheetState={sheetState}
          onConnectGoogle={handleConnectGoogle}
          onSubmitWish={handleWishSubmit}
        />
      </main>

      {/* 簡約頁尾 */}
      <footer className="mt-12 border-t border-[#E8DFC8] bg-[#F7F2EA]/80 py-6 text-center text-xs text-[#8A7566]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-[#8C5E3C]" />
            <span className="font-serif font-bold text-[#3D2C22]">咖啡豆選擇平台</span>
            <span className="text-[#B39D8C]">|</span>
            <span>第一階段 核心選豆與 Google Sheets 紀錄</span>
          </div>
          <div className="text-[11px] text-[#9A8475]">
            已預留庫存、價格、管理者介面與 LINE Bot 整合擴充模組
          </div>
        </div>
      </footer>

      {/* Google Sheets 設定與說明彈窗 */}
      <GoogleSheetsModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        sheetState={sheetState}
        onConnectGoogle={handleConnectGoogle}
        onDisconnectGoogle={handleDisconnectGoogle}
        onRefreshSpreadsheet={handleRefreshSpreadsheet}
      />
    </div>
  );
}
