
import {db, getRepositoriesByStatus} from "../tools/database";
import path from "path";
import {findPackageJSONPath, formattedLog, parsePackageJSON, REPOSITORIES_PATH} from "../tools/helper";
import {PathLike} from "fs";

/**
 * Return if a repository as a dependency
 * @param packageJSONDependencies
 * @param found
 */
function hasDependency(packageJSONDependencies: Record<string,string>, found: string): boolean {
    return packageJSONDependencies.hasOwnProperty(found)
}

/**
 * Get repository dependencies
 * @param projectName
 * @param repoPath
 */
async function getDependencies(projectName: string, repoPath: PathLike): Promise<Record<string, string>> {
    const packageJSONPath = await findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        throw new Error('package.json not found')
    }
    return await parsePackageJSON(packageJSONPath);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();

    console.log('Fetching uncategorized repositories...');
    const repositories = await getRepositoriesByStatus('uncategorized');
    console.log(repositories.length + " project(s) found!");

    for (let repo of repositories) {
        const repoPath = path.resolve(REPOSITORIES_PATH, `${repo.name}_${repo.id}`);
        const packageJSONDependencies = await getDependencies(repo.name, repoPath);

        if (!hasDependency(packageJSONDependencies, 'webpack')){
            formattedLog(repo.name,`⚠️  Not a webpack project`);
            repo.category = "not_webpack";
            repo.status = 'blacklisted';
            await repo.save();
            continue;
        }

        switch (true) {
            case hasDependency(packageJSONDependencies, '@angular'): {
                formattedLog(repo.name,` =>  angular project`);
                repo.category = "angular";
                break;
            }
            case hasDependency(packageJSONDependencies, 'react'): {
                formattedLog(repo.name,` => react project`);
                repo.category = "react";
                break;
            }
            case hasDependency(packageJSONDependencies, '@vue'): {
                formattedLog(repo.name,` => vue project`);
                repo.category = "vue";
                break;
            }
            case hasDependency(packageJSONDependencies, 'express'): {
                formattedLog(repo.name,` => express project`);
                repo.category = "express";
                break;
            }
            case hasDependency(packageJSONDependencies, '@nestjs'): {
                formattedLog(repo.name,` => nestjs project`);
                repo.category = "nestjs";
                break;
            }
            case hasDependency(packageJSONDependencies, 'next'): {
                formattedLog(repo.name,` => next project`);
                repo.category = "next";
                break;
            }
            default: {
                formattedLog(repo.name,` => native project`);
                repo.category = "native";
            }
        }

        repo.status = 'categorized';
        await repo.save();
    }
})();