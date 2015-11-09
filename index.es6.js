import metaEval from "meta-eval";
import fs from "fs";
import {transform} from "babel-core";

const PrintTranspilation = true;

export default class ModuleGarden {
	constructor ({
		name: gardenName,
		modules: filePatterns,
		environment: initialEnvironment,
		dependencies,
		afterDependencies,
		dependencyResolver,
		nativeExtensions=[], transpile=false, strict=true
	}) {
		let sourceUrlBase = "moduleGarden://" + gardenName;
		this.modules = {};

		for (let dependencyIdentifier of Object.keys(dependencies)) {
			global[dependencyIdentifier] = module.parent.require(dependencies[dependencyIdentifier]);
			this.modules[dependencyIdentifier] = new Module(dependencyIdentifier, {isDependency: true});
		}

		if (afterDependencies) afterDependencies();

		global.require = (name) => {
			if (global[name])
				if (this.modules[name].loaded) return global[name];
				else return this.modules[name].load(this.walledGarden);
			else return module.parent.require(name);//throw `Error: cannot find module ${name} in ModuleGarden ${gardenName}`;
		};

		let filenames = [];
		for (let pattern of filePatterns)
			explore(".", pattern.split("/"), filenames);

		for (let filename of filenames) {
			let basename = getBasename(filename);
			let name = basename.substr(0, basename.lastIndexOf("."));

			global[name] = {};
			this.modules[name] = new Module(filename, {transpile, strict});
		}

		for (let filename of nativeExtensions) {
			let name = getBasename(filename);

			let source = getSource("./" + filename, true, transpile);
			source = source + "\n" + `//# sourceURL=mg://${gardenName}/${filename.replace("./", "")}`;

			metaEval(source, {}, name, filename, sourceUrlBase);
		}

		for (let moduleName of Object.keys(this.modules)) {
			this.modules[moduleName].load(sourceUrlBase);
		}
	}

	get environment () {
		return global
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

function getSource(filename, transpile=false) {
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

	if (filename.indexOf("./engine") !== -1 || filename.indexOf("./game") !== -1) {
		var cacheStat;
		var cacheFilename = ".babelCache/" + filename.slice(2);
		try {
			cacheStat = fs.statSync(cacheFilename);
		} catch (e) {
			cacheStat = undefined;
		}

		var transpiled;

		if (!cacheStat || cacheStat.mtime < sourceStat.mtime) {
			transpiled = transform(source, {
				blacklist: ["regenerator", "es6.tailCall"/*, "es6.forOf"*/],
				loose: ["es6.forOf"],
				optional: ["es7.classProperties"],
				filename: filename,
				sourceMaps: false,
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

class Module {
	constructor (filename, {transpile=false, strict=true, isDependency=false}) {
		let basename = getBasename(filename)
		this.filename = filename;
		this.name = basename.substr(0, basename.lastIndexOf("."));
		this.loaded = isDependency || false;
		this.source = !isDependency && getSource(filename, transpile);
		this.exports = {};
		this.strict = strict;
	}

	load (sourceUrlBase) {
		if (this.loaded) return global[this.name];

		let source = this.source;

		source =
`var exports = ${this.name}, module = {exports: exports};

(function() {${source}})();

if (module.exports !== exports) global.${this.name} = module.exports;`;

		if (this.strict) source = '"use strict";\n' + source;

		metaEval(source, {}, this.name, this.filename, sourceUrlBase);

		this.loaded = true;

		return global[this.name];
	}
}