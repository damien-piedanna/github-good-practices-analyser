import * as path from "path";
import { PathLike } from "fs";
import fs from "fs/promises";
import { db } from "./database";

export const ROOT_PATH = path.resolve(__dirname,'../..');
console.log(ROOT_PATH);
export const REPOSITORIES_PATH = path.resolve(ROOT_PATH,'repositories');
export const CATEGORIES = ['native', 'react', 'vue'];

/**
 * Formats log messages to handle GitHub's repository names
 * Example : 101085586-limit_login_to_ip| ❌ No package.json found
 * @param repositoryGithub
 * @param message
 * @param optionalParams
 */
export function formattedLog(repositoryGithub: string,message?: any, ...optionalParams: any[]){
    const formattedRepositoryName = repositoryGithub
        .slice(0,repositoryGithub.lastIndexOf("-"))
        .slice(0,15);
    console.log(`${formattedRepositoryName.padEnd(15)}| ${message}`, ...optionalParams);
}

/**
 * Get all files from directory
 * @param dir - directory path
 */
export async function getFilesFromDirectory(dir: PathLike): Promise<string[]> {
    const subDirs = await fs.readdir(dir);
    const files = await Promise.all(subDirs.map(async (subdir) => {
        const res = path.resolve(dir.toLocaleString(), subdir);
        const stat = await fs.lstat(res);
        return stat.isDirectory() && !stat.isSymbolicLink() ? getFilesFromDirectory(res) : [res];
    }));
    if( files.length === 0 ){
        return [];
    }
    return files.reduce((a, f) => a.concat(f, []));
}

/**
 * Find a file in a directory
 * @param name - File name
 * @param dir - File directory
 */
export async function findFile(name: string, dir: PathLike): Promise<string | null> {
    const files = await getFilesFromDirectory(dir);
    const found = files.find((file) => file.endsWith(name));
    return found ?? null;
}

/**
 * Clean the database and downloaded repositories
 */
export async function reset() {
    //Delete repositories folder
    const folderContent = await fs.readdir(REPOSITORIES_PATH, { withFileTypes: true });
    folderContent
        .filter((item) => item.isDirectory())
        .map((item) => fs.rm( path.resolve(REPOSITORIES_PATH, item.name), {recursive: true}));
    //Delete from database
    await db.sync({force: true});
}