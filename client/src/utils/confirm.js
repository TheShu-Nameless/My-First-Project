import { ElMessageBox } from 'element-plus';

const baseOpts = {
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  customClass: 'tcm-confirm-dialog',
  closeOnClickModal: false,
};

/**
 * 二次确认弹窗：中文按钮 + 统一视觉类名（与 main.scss 配套）
 */
export function confirmZh(message, title = '请确认', extra = {}) {
  return ElMessageBox.confirm(message, title, {
    ...baseOpts,
    ...extra,
    customClass: extra.customClass ? `${baseOpts.customClass} ${extra.customClass}`.trim() : baseOpts.customClass,
  });
}
