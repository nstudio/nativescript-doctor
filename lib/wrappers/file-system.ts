import * as fs from "fs";
import * as path from "path";
import * as yauzl from "yauzl";
import * as util from "util";
import * as shelljs from "shelljs";

const access = util.promisify(fs.access);
const mkdir = util.promisify(fs.mkdir);

export class FileSystem {
	public exists(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	public extractZip(pathToZip: string, outputDir: string): Promise<void> {
		return new Promise((resolve, reject) => {
			yauzl.open(pathToZip, { autoClose: true, lazyEntries: true }, (openError, zipFile) => {
				if (openError) {
					return reject(openError);
				}

				zipFile.on('entry', entry => {
					const fn = <string>entry.fileName;
					if (/\/$/.test(fn)) {
						return zipFile.readEntry();
					}

					zipFile.openReadStream(entry, (openStreamError, stream) => {
						if (openStreamError) {
							return reject(openStreamError);
						}

						const filePath = `${outputDir}/${fn}`;

						return createParentDirsIfNeeded(filePath)
							.catch(createParentDirError => reject(createParentDirError))
							.then(() => {
								const outfile = fs.createWriteStream(filePath);
								stream.once('end', () => {
									zipFile.readEntry();
								});
								stream.pipe(outfile);
							});
					});
				});

				zipFile.once('end', () => resolve());

				zipFile.readEntry();
			});
		});
	}

	public readDirectory(directoryPath: string): string[] {
		return fs.readdirSync(directoryPath);
	}

	public readJson<T>(filePath: string, options?: { encoding?: null; flag?: string; }): T {
		const content = fs.readFileSync(filePath, options);
		return JSON.parse(content.toString());
	}

	public deleteEntry(filePath: string): void {
		shelljs.rm("-rf", filePath);
	}
}

function createParentDirsIfNeeded(filePath: string) {
	const dirs = path.dirname(filePath).split(path.sep);
	return dirs.reduce((p, dir) => p.then(parent => {
		const current = `${parent}${path.sep}${dir}`;

		return access(current)
			.catch(e => mkdir(current))
			.then(() => current);
	}), Promise.resolve(''));
}
