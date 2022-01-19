import { Octokit } from "@octokit/rest";
import * as path from 'path';
import gitClone from 'git-clone/promise';
import fined from "fined";
import fs from 'fs';
const library: string = process.argv[2] ?? 'webpack';
const octokit = new Octokit();

/**
 * Fetches repositories from GitHub
 */
async function fetchRepositoriesByLibrary(library: string, queryParams: {} = {
        sort: 'updated',
        order: 'desc',
        per_page: 10,
}): Promise<any> {
    /**
     * @link https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
     * @warning package.json may not be located at the root
     */
    const response =  await octokit.rest.search.repos({
        q: library + '+in:package.json+language:javascript+archived:false+is:public',
        ...queryParams,
        page: 1,
    });
    const data = response.data;
    const cloneActions: Promise<string>[] = data.items.map(cloneRepository);
    const repositoryPaths =  await Promise.all(cloneActions);

    for (const clonePath of repositoryPaths) {
        analyseRepository(clonePath);
    }
}

async function findPackageJSONPath(repoPath: fs.PathLike): Promise<fs.PathLike | null> {
  const packageJSONPath = path.normalize(repoPath + "/package.json");
  if (fs.existsSync(packageJSONPath)) {
    return packageJSONPath;
  }
  const packageJSONPaths = await fined({
    path: repoPath.toLocaleString(),
    name: "package.json",
  });
  return packageJSONPaths?.path ?? null;
}

async function parsePackageJSON(packagePath: fs.PathLike){
    
    const packageJSON = require('' + packagePath);
    const dependencies = packageJSON.dependencies;
    const devDependencies = packageJSON.devDependencies;
    const peerDependencies = packageJSON.peerDependencies;
    const optionalDependencies = packageJSON.optionalDependencies;
    const allDependencies = {...dependencies, ...devDependencies, ...peerDependencies, ...optionalDependencies};
    console.log(allDependencies);
}

async function analyseRepository(repoPath: fs.PathLike): Promise<void> {
  const packageJSONPath = await findPackageJSONPath(repoPath);
  if (packageJSONPath) {
    await parsePackageJSON(packageJSONPath);
  }
}

async function cloneRepository(repo: any): Promise<string> {
  //id,name,created_at,stargazers_count
  console.log("Project " + repo.name);
  console.log("Cloning...");
  const repoPath = path.normalize(
    path.resolve(__dirname) + "/../repositories/" + repo.id
  );
  await gitClone(repo.clone_url, repoPath);
  console.log("Analysing...");
  console.log(
    "As .eslintrc => " +
      (fined({ path: repoPath, name: ".eslintrc" }) ? "yes" : "no")
  );

  return repoPath;
}
(async () => {
    await fetchRepositoriesByLibrary(library, {
        pages: 2,
    });
})();
