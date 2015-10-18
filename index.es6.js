import WalledGarden from "walled-garden";
import fs from "fs";

export default class ModuleGarden {
	constructor ({name: gardenName, modules: filePatterns, environment: intialEnvironment, nativeExtensions=[], transpile=false}) {
		this.walledGarden = new WalledGarden(intialEnvironment);

		for (let filename of nativeExtensions) {
			let name = getBasename(filename);

			let source = getSource(filename, true, transpile);
			source = source + "\n" + `//# sourceURL=moduleGarden://${name}${filename}`;

			this.walledGarden.run(source);
		}

		let filenames = [];
		explore(".", pattern.split("/"), filenames);

		for (let filename of filenames) {
			let name = getBasename(filename);

			if (typeof this.walledGarden.environment[name] === "undefined")
				this.walledGarden.environment[name] = {};

			let source = getSource(filename, true, transpile);
			source =
`var exports = ${name}, module = {exports: exports};

${source}

if (module.exports !== exports) global.${name} = module.exports}
//# sourceURL=moduleGarden://${name}${filename}`;

			this.walledGarden.run(source);
		}


	}


}

function explore(path, parts, filenames) {
	if (parts.length === 0)
		return (path.substr(path.length - 3) === ".js")
			&& fs.statSync(path).isFile()
			&& filenames.push(path);

	var filename = parts[0],
		remaining = parts.slice(1);

	if (filename.indexOf("*") === -1) {
		if (fs.existsSync(path + "/" + filename))
			explore(path + "/" + filename, remaining, filenames);
	} else {
		if (fs.statSync(path).isDirectory())
			for (let filename of fs.readdirSync(path))
				explore(path + "/" + filename, remaining, filenames);
	}
}

function getBasename(filename) {
	return filename.substr(filename.lastIndexOf("/") + 1);
}

function getSource(filename, strict=true, transpile=false) {
	function stripBOM(content) {
		// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
		// because the buffer-to-string conversion in `fs.readFileSync()`
		// translates it to FEFF, the UTF-16 BOM.
		if (content.charCodeAt(0) === 0xFEFF) {
			content = content.slice(1);
		}
		return content;
	}

	var sourceStat = fs.statSync(filename);
	var source = stripBOM(fs.readFileSync(filename, 'utf8'));

	if (strict)
		source = '"use strict";\n' + source;

	if (transpile &&  filename.indexOf("./engine") !== -1 || filename.indexOf("./game") !== -1) {
		var cacheStat;
		var cacheFilename = ".babelCache/" + filename.slice(2);
		try {
			cacheStat = fs.statSync(cacheFilename);
		} catch (e) {
			cacheStat = undefined;
		}

		var transpiled;

		if (!cacheStat || cacheStat.mtime < sourceStat.mtime) {
			transpiled = babel.transform(source, {
				blacklist: ["regenerator", "es6.tailCall"],
				loose: ["es6.forOf"],
				optional: ["es7.classProperties"],
				filename: filename,
				sourceMaps: false,//"inline",
				sourceMapName: sourceUrlBase + filename.replace("./", "")
			});

			cacheFilename.split('/').reduce(function(prev, curr, i) {
				if(fs.existsSync(prev) === false) {
					fs.mkdirSync(prev);
				}
				return prev + '/' + curr;
			});

			fs.writeFileSync(cacheFilename, transpiled.code, {encoding: 'utf8'});

			if (PrintTranspilation) {
				console.groupCollapsed("transpiled " + filename);
				console.log(transpiled.code.split("\n").map((l, i) => i + ": " + l).join("\n"));
				console.groupEnd();
			}
		} else {
			transpiled = {
				code: fs.readFileSync(cacheFilename, "utf8")
			};
		}

		source = transpiled.code;
	}

	return source;
}