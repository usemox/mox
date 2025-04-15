import { ElectronAPI } from '@electron-toolkit/preload'
import { ElectronApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ElectronApi
  }
}
