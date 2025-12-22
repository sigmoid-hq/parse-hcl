"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTextFile = readTextFile;
exports.readJsonFile = readJsonFile;
exports.listTerraformFiles = listTerraformFiles;
exports.pathExists = pathExists;
exports.isDirectory = isDirectory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function readTextFile(filePath) {
    return fs_1.default.readFileSync(filePath, 'utf-8');
}
function readJsonFile(filePath) {
    return JSON.parse(readTextFile(filePath));
}
function listTerraformFiles(dirPath) {
    const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && (entry.name.endsWith('.tf') || entry.name.endsWith('.tf.json')))
        .map((entry) => path_1.default.join(dirPath, entry.name));
}
function pathExists(targetPath) {
    return fs_1.default.existsSync(targetPath);
}
function isDirectory(targetPath) {
    return fs_1.default.existsSync(targetPath) && fs_1.default.statSync(targetPath).isDirectory();
}
