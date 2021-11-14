import * as path from "path";
import os from 'os';
import { WOW_CLASSIC_ERA_FOLDER, WOW_CLASSIC_ERA_PTR_FOLDER } from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

const WOW_RETAIL_NAME = "Wow.exe";
const WOW_RETAIL_PTR_NAME = "WowT.exe";
const WOW_RETAIL_BETA_NAME = "WowB.exe";
const WOW_CLASSIC_NAME = "WowClassic.exe";
const WOW_CLASSIC_PTR_NAME = "WowClassicT.exe";
const WOW_CLASSIC_BETA_NAME = "WowClassicB.exe";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
];

const LUTRIS_DEFAULT_LIBRARY_PATH = "/Games"
const LUTRIS_CONFIG_PATH = "/.config/lutris";
const LUTRIS_CONFIG_FILE = "system.yml";
// Search in this order until products are found on one.
// All WoW products can be found under any or all of them,
// since each of them are essentially just Battle.net
// launchers with a different install path.
const LUTRIS_WOW_DIRS = [
  "battlenet/drive_c",
  "world-of-warcraft/drive_c",
  "world-of-warcraft-classic/drive_c"];

// BLIZZARD STRINGS
const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceLinux implements WarcraftServiceImpl {
  public constructor(private _electronService: ElectronService, private _fileService: FileService) { }

  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  /**
   * On Linux players are normally using Lutris to install Battle.net launcher or WoW
   */
  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const lutrisLibraryPath = await this.getLutrisWowProductPath();
      if (lutrisLibraryPath.length === 0) {
        throw new Error("Lutris library not found");
      }

      const agentPath = path.join(lutrisLibraryPath, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
      console.log(`Agent path: ${agentPath}`)
      const agentPathExists = await this._fileService.pathExists(agentPath);

      if (agentPathExists) {
        console.log(`Found products at ${agentPath}`);
        return agentPath;
      }

    } catch (e) {
      console.error("Failed to search for blizzard products", e);
    }

    return "";
  }

  public async getLutrisWowProductPath(): Promise<string> {
    const lutrisConfigPath = path.join(os.homedir(), LUTRIS_CONFIG_PATH);
    try {
      const lutrisConfigPathExists = await this._fileService.pathExists(lutrisConfigPath);
      if (lutrisConfigPathExists) {
        const lutrisConfigFilePath = path.join(lutrisConfigPath, LUTRIS_CONFIG_FILE);
        const lutrisConfigFileExists = await this._fileService.pathExists(lutrisConfigFilePath)
        let libraryPath: string;
        if (lutrisConfigFileExists) {
          const lutrisConfig = await this._fileService.readFile(lutrisConfigFilePath);
          const libraryPathRegex = new RegExp(`game_path: (.*)`);
          const potentialLibraryPath = libraryPathRegex.exec(lutrisConfig)[1].trim();
          const libraryPathExists = await this._fileService.pathExists(potentialLibraryPath);
          if (libraryPathExists) {
            libraryPath = potentialLibraryPath;
          }
        }
        // If the system.yml file doesn't exist, or game_path entry does not exist within it,
        // then use the default game installation path.
        if (libraryPath.length == 0) {
          libraryPath = path.join(os.homedir(), LUTRIS_DEFAULT_LIBRARY_PATH);
        }
        const libraryPathExists = await this._fileService.pathExists(libraryPath);
        if (libraryPathExists) {
          for (const wowDir of LUTRIS_WOW_DIRS) {
            const productPath = path.join(libraryPath, wowDir);
            const productPathExists = await this._fileService.pathExists(productPath);
            if (productPathExists) {
              console.log(`Found WoW product in Lutris library at ${productPath}`);
              return productPath
            }
          }
        }
      }
      throw new Error()
    } catch (e) {
      console.error("Failed to search for Lutris library location", e);
    }
    return "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
      case WowClientType.ClassicEra:
      case WowClientType.Classic:
        return WOW_CLASSIC_NAME;
      case WowClientType.RetailPtr:
        return WOW_RETAIL_PTR_NAME;
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicEraPtr:
        return WOW_CLASSIC_PTR_NAME;
      case WowClientType.Beta:
        return WOW_RETAIL_BETA_NAME;
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(binaryPath: string): WowClientType {
    const binaryName = path.basename(binaryPath);
    switch (binaryName) {
      case WOW_RETAIL_NAME:
        return WowClientType.Retail;
      case WOW_CLASSIC_NAME:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_FOLDER)) {
          return WowClientType.ClassicEra;
        } else {
          return WowClientType.Classic;
        }
      case WOW_RETAIL_PTR_NAME:
        return WowClientType.RetailPtr;
      case WOW_CLASSIC_PTR_NAME:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_PTR_FOLDER)) {
          return WowClientType.ClassicEraPtr;
        } else {
          return WowClientType.ClassicPtr;
        }
      case WOW_RETAIL_BETA_NAME:
        return WowClientType.Beta;
      case WOW_CLASSIC_BETA_NAME:
        return WowClientType.ClassicBeta;
      default:
        return WowClientType.None;
    }
  }
}
