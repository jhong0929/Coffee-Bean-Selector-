import React, { useState } from 'react';
import { SheetConnectionState } from '../types';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LogIn,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { ORDERS_COLUMNS, WISH_COLUMNS, BEAN_LIST_COLUMNS } from '../services/googleSheets';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetState: SheetConnectionState;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onRefreshSpreadsheet: () => void;
  onCustomSheetIdSave?: (sheetId: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  sheetState,
  onConnectGoogle,
  onDisconnectGoogle,
  onRefreshSpreadsheet,
  onCustomSheetIdSave,
}) => {
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyId = () => {
    if (sheetState.spreadsheetId) {
      navigator.clipboard.writeText(sheetState.spreadsheetId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#FAF7F2] border border-[#D5C6B3] rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8DFC8] flex items-center justify-between bg-[#F5EFEB]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#4A3225] text-[#FAF6F0]">
              <FileSpreadsheet className="w-5 h-5 text-[#E6CDB5]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-[#2C1D15]">
                Google Sheets 雲端連線設定
              </h3>
              <p className="text-xs text-[#7B6656]">
                安全授權儲存訂單與許願池紀錄
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7B6656] hover:text-[#2C1D15] rounded-full hover:bg-[#EAE0D1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-[#443126]">
          {/* Connection Status Box */}
          <div
            className={`p-4 rounded-2xl border ${
              sheetState.isConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {sheetState.isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {sheetState.isConnected
                      ? '已成功連線至 Google Sheets'
                      : '目前尚未連線 Google 帳號'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {sheetState.isConnected
                      ? `授權帳號：${sheetState.userEmail || '已授權使用者'}`
                      : '未完成連線前，訂單與許願池將無法寫入雲端'}
                  </p>
                </div>
              </div>

              {sheetState.isConnected ? (
                <button
                  type="button"
                  onClick={onDisconnectGoogle}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>中斷連線</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  disabled={sheetState.isLoading}
                  className="px-4 py-2 bg-[#4A3225] hover:bg-[#382317] text-[#FAF6F0] rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {sheetState.isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#FAF6F0] border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  <span>登入 Google 授權</span>
                </button>
              )}
            </div>

            {/* Current Spreadsheet Details */}
            {sheetState.isConnected && sheetState.spreadsheetId && (
              <div className="mt-4 pt-3 border-t border-emerald-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#635144]">試算表名稱</span>
                  <span className="font-semibold text-[#2C1D15]">
                    {sheetState.spreadsheetTitle || '咖啡豆選擇平台 (訂單與許願池)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#635144]">試算表 ID</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                      {sheetState.spreadsheetId.substring(0, 16)}...
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 hover:bg-emerald-100 rounded text-emerald-800"
                      title="複製完整 ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {sheetState.spreadsheetUrl && (
                    <a
                      href={sheetState.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#8C5E3C] hover:text-[#5C3920] font-semibold underline underline-offset-2"
                    >
                      <span>在 Google Sheets 開啟此試算表</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onRefreshSpreadsheet}
                    disabled={sheetState.isLoading}
                    className="inline-flex items-center gap-1 text-xs text-[#7B6656] hover:text-[#2C1D15]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sheetState.isLoading ? 'animate-spin' : ''}`} />
                    <span>重新同步工作表</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security & Architecture Explanation */}
          <div className="bg-[#F4ECE0] rounded-2xl p-4 border border-[#DDD0BE] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#3D291E]">
              <ShieldCheck className="w-4 h-4 text-[#8C5E3C]" />
              <span>安全性與資料隱私架構</span>
            </div>
            <ul className="list-disc list-inside text-xs text-[#635043] space-y-1 leading-relaxed">
              <li>
                <strong>私密權限：</strong>本系統透過 Google 官方 OAuth 授權，試算表建立於您個人 Google Drive，<strong>無需且絕不可設為「任何人皆可編輯」</strong>。
              </li>
              <li>
                <strong>無金鑰洩漏風險：</strong>不在瀏覽器暴露服務帳號金鑰或私鑰，存取權限僅於登入期間有效。
              </li>
              <li>
                <strong>自動工作表建置：</strong>登入後系統自動建立「Orders」與「BeanWishList」兩張工作表，並設定標準標題列。
              </li>
            </ul>
          </div>

          {/* Spreadsheet Sheet Schema Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-[#523C2F] tracking-wide uppercase">
              試算表欄位架構規範
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#FAF8F5] border border-[#E0D5C3] rounded-xl">
                <span className="font-bold text-[#2E1E16] block mb-1">
                  工作表一：BeanList ({BEAN_LIST_COLUMNS.length} 欄位)
                </span>
                <p className="text-[11px] text-[#786455] leading-relaxed">
                  {BEAN_LIST_COLUMNS.join(' · ')}
                </p>
                <span className="text-[10px] text-emerald-800 font-medium block mt-1">★ 轉盤與選豆即時資料來源</span>
              </div>
              <div className="p-3 bg-[#FAF8F5] border border-[#E0D5C3] rounded-xl">
                <span className="font-bold text-[#2E1E16] block mb-1">
                  工作表二：Orders ({ORDERS_COLUMNS.length} 欄位)
                </span>
                <p className="text-[11px] text-[#786455] leading-relaxed">
                  {ORDERS_COLUMNS.join(' · ')}
                </p>
              </div>
              <div className="p-3 bg-[#FAF8F5] border border-[#E0D5C3] rounded-xl">
                <span className="font-bold text-[#2E1E16] block mb-1">
                  工作表三：BeanWishList ({WISH_COLUMNS.length} 欄位)
                </span>
                <p className="text-[11px] text-[#786455] leading-relaxed">
                  {WISH_COLUMNS.join(' · ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E8DFC8] bg-[#F5EFEB] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#4A3225] hover:bg-[#382317] text-[#FAF6F0] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            關閉說明
          </button>
        </div>
      </div>
    </div>
  );
};
