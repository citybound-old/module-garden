*This module is part of and developed for [Citybound](http://cityboundsim.com).
At some point in the future it might become generally useful!*

# module-garden

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

A module loader that adds all modules as globals (and transpiles them as a bonus).

## Purpose

In a project as huge and interconnected as Citybound, it can be annoying for modules to always have to require their dependecies.
module-garden allows all modules to be automatically loaded into the global scope, making implicit cross-referencing easy.

## Usage

Notice how in this fake game all modules can just be referred to without having been required.

`index.js`
```javascript
var ModuleGarden = require("module-garden");

new ModuleGarden({
	name: "citybound",
	transpile: true,
	
	// folder patterns or files containing modules, in the order they should be loaded
	modules: [
		"engine/*",
		"game/*",
		"startGame.js"
	],
	
	// extern (npm or local) dependencies that should also be loaded as globals (key = alias)
	dependencies: {
		"ndLinalg": "nd-linalg",
		"$": "./lib/jquery"
	},
	
	// set up additional aliases and shorthands after external dependencies are loaded
	afterDependencies: function () {
		global.vec2 = global.ndLinalg.Vector2;
	}
});
```

`engine/Particle.js`
```javascript
export default class Particle {
    constructor () {
        this.position = vec2(0, 0);
        this.velocity = vec2(0, 0);
    }
    
    update (dt) {
        vec2.scaleAndAdd(this.position, this.position, this.velocity, dt); 
    }
}
```


`game/Explosion.js`
```javascript
export default class Explosion {
    constructor (nParticles) {
        this.particles = [];
        
        for (let i = 0; i < nParticles; i++) {
            let particle = new Particle();
            particle.velocity = vec2(Math.random() - 0.5, Math.random() - 0.5);
            this.particles.push();
        }
    }
    
    update (dt) {
        for (let particle of this.particles) particle.update(dt);
    }
}
```

`startGame.js`
```javascript
$('document').ready(() => {
    let fire = new Fire();
    
    let dt = 1/60;
    
    setInterval(() => fire.update(dt), dt);
})
```

## Caveats

Using module-garden requires a bit of care:

Modules should usually not expect any of their dependencies to be already evaluated when they themselves are being evaluated.
If a module really requires this, it can still explicitly `require` its dependency.

## Contribution

Goals, wishes and bugs are managed as GitHub Issues - if you want to help, have a look there and submit your work as pull requests.
Your help is highly welcome! :)

## License

MIT, see [LICENSE.md](http://github.com/aeickhoff/module-garden/blob/master/LICENSE.md) for details.
