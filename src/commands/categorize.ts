import { db, getRepositoriesByStatus, Repository } from "../tools/database";
import path from "path";
import { findPackageJSONPath, parsePackageJSON, REPOSITORIES_PATH } from "../tools/helper";
import { PathLike } from "fs";

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

/**
 * Categorized a repository
 * @param repo
 */
async function categorizedRepository(repo: Repository): Promise<void> {
    const repoPath = path.resolve(REPOSITORIES_PATH, `${repo.name}_${repo.id}`);
    const packageJSONDependencies = await getDependencies(repo.name, repoPath).catch(() => { return {} });

    if (!hasDependency(packageJSONDependencies, 'webpack')){
        repo.category = "not_webpack";
        repo.status = 'blacklisted';
        await repo.save();
        return;
    }

    repo.status = 'categorized';

    switch (true) {
        case hasDependency(packageJSONDependencies, '@angular'): {
            repo.category = "angular";
            break;
        }
        case hasDependency(packageJSONDependencies, 'react'): {
            repo.category = "react";
            break;
        }
        case hasDependency(packageJSONDependencies, '@vue'): {
            repo.category = "vue";
            break;
        }
        case hasDependency(packageJSONDependencies, 'express'): {
            repo.category = "express";
            break;
        }
        case hasDependency(packageJSONDependencies, '@nestjs'): {
            repo.category = "nestjs";
            break;
        }
        case hasDependency(packageJSONDependencies, 'next'): {
            repo.category = "next";
            break;
        }
        default: {
            repo.category = "native";
        }
    }
    await repo.save();
}


// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();

    console.log('Fetching uncategorized repositories...');
    const repositories = await getRepositoriesByStatus('uncategorized');
    console.log(repositories.length + " project(s) found!");

    let endedCategorized: number = 0;
    process.stdout.write(`Categorized...`);
    const categorizeActions: Promise<void>[] = repositories.map((repo: any) => categorizedRepository(repo)
    .then(async () => {
        endedCategorized++;
        process.stdout.write(`\rCategorized... ${endedCategorized}/${repositories.length}`);
        await categorizedRepository(repo);
    }));
    await Promise.all(categorizeActions);

    console.log('\nDone!');
})();