// Global Variables

const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
let globalWidth = window.innerWidth;
let globalHeight = window.innerHeight;

let x = 0;
let y = 0;

// Shared Audio Context

let sharedAudioContext;

function getAudioContext() {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        sharedAudioContext = new AudioContext();
    }
    return sharedAudioContext;
}

// Colour Class

class Colour {
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    toRgba() {
        return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`; // this.a is an exception (works on 0 to 1)
    }

    withAlpha(a) {
        return new Colour(this.r, this.g, this.b, a);
    }

    grayScale() {
        let sourceColour = Math.min(this.r, this.g, this.b);
        return new Colour(sourceColour, sourceColour, sourceColour, this.a);
    }

    invert() {
        return new Colour(1.0 - this.r, 1.0 - this.g, 1.0 - this.b, this.a);
    }

    static hex(hexcolour) {
        let matches = hexcolour.match(/#([0-9a-g]{2})([0-9a-g]{2})([0-9a-g]{2})/i); // returns 3 groups of 2
        if (matches) {
            let [, r, g, b] = matches;
            return new Colour(parseInt(r, 16) / 255,
                parseInt(g, 16) / 255,
                parseInt(b, 16) / 255,
                1.0);
        } else {
            throw new Error(`Could not parse ${hexcolour} as colour`, console.error);
        }
    }
}

const playerColour = Colour.hex('#72b1e5');
const playerRadius = 48;
const playerSpeed = 600;
const playerMaxHealth = 100;
const playerTrailFadoutRate = 3.0;

const bulletColour = Colour.hex('#e7b80b');
const bulletRadius = 6;
const bulletSpeed = playerSpeed * 3;
const bulletLifetime = 5; // important - prevents memory overflow

const enemyColour = Colour.hex('#df7171');
const enemyRadius = playerRadius - 6;
const enemySpeed = playerSpeed / 3;
const enemySpawnCooldown = 1;
const enemySpawnDistance = 500;
const enemyDamage = playerMaxHealth / 5;
const enemyKillHealer = playerMaxHealth / 20;
const enemyKillScore = 100;

const particleCount = 50;
const particleRadius = 5;
const particleMagnitude = bulletSpeed;
const particleLifetime = 1;
// const particleColour = Colour.hex('#ffedb8'); - replaced by playerColour and enemyColour for particleBurst

const messageColour = Colour.hex('#ffffff');
const smallFont = '18px';
const normalFont = '32px';

const healthBarHeight = 15;
const healthBarColour = Colour.hex('#51bb51');


// b&w for pause screen

function grayScaleFilter(colour) {
    return colour.grayScale();
}

// id filter

function idFilter(colour) {
    return colour;
}

let globalFillFilter = idFilter;

// Camera class

class Camera {
    pos = new v2(0, 0);
    vel = new v2(0, 0);

    constructor(context) {
        this.context = context;
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
    }

    clear() {
        const width = this.context.canvas.width;
        const height = this.context.canvas.height;
        this.context.clearRect(0, 0, width, height);
    }

    toWorld(point) {
        const width = this.context.canvas.width;
        const height = this.context.canvas.height;

        return point.sub(new v2(width / 2, height / 2)).add(this.pos);
    }

    toScreen(point) {
        const width = this.context.canvas.width;
        const height = this.context.canvas.height;

        return point.sub(this.pos).add(new v2(width / 2, height / 2));
    }

    setTarget(target) {
        this.vel = target.sub(this.pos);
    }

    width() {
        return this.context.canvas.width;
    }

    height() {
        return this.context.canvas.height;
    }

    // Draw Shapes

    fillCircle(centre, playerRadius, colour) {
        const screenCentre = this.toScreen(centre);

        this.context.fillStyle = globalFillFilter(colour).toRgba();
        this.context.beginPath();
        this.context.arc(screenCentre.x, screenCentre.y, playerRadius, 0, 2 * Math.PI, false);
        this.context.fill();
    }

    // For health bar

    strokeRect(x, y, w, h, colour) {
        this.context.strokeStyle = colour.toRgba();
        this.context.lineWidth = 3;
        this.context.strokeRect(x, y, w, h);
    }

    fillRect(x, y, w, h, colour) {
        this.context.fillStyle = globalFillFilter(colour).toRgba();
        this.context.fillRect(x, y, w, h);
    }

    // For score

    scoreText(x, y, text, colour) {
        this.context.fillStyle = colour.toRgba();

        // If small screen update font

        if (globalWidth < 640) {
            this.context.font = `${smallFont} VT323, monospace`;
        } else {
            this.context.font = `${normalFont} VT323, monospace`;
        }

        this.context.textAlign = 'center';
        this.context.fillText(text, x, y);
    }

    // Pause text

    fillMessage(text, colour) {
        this.context.fillStyle = colour.toRgba();

        // If small screen update font

        if (globalWidth < 640) {
            this.context.font = `${smallFont} VT323, monospace`;
        } else {
            this.context.font = `${normalFont} VT323, monospace`;
        }

        this.context.textAlign = 'center';
        this.context.fillText(text, globalWidth / 2, globalHeight / 2 + 5);
    }
}


// Sounds

let lastGunfireTime = 0;
const gunfireCooldown = 0.05; // time between sound triggers

let lastHitTime = 0;
const hitCooldown = 0.1;

let lastDeathTime = 0;
const deathCooldown = 1;

const audioPlay = async url => {
    try {
        const context = getAudioContext();

        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start();
    } catch (e) {
        console.warn('Audio failed:', e);
    }
};

// Handle Window Resize

function handleWindowResize() {
    globalWidth = window.innerWidth;
    globalHeight = window.innerHeight;
}

window.onresize = handleWindowResize;

// Classes

class v2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(that) {
        return new v2(this.x + that.x, this.y + that.y);
    }

    sub(that) {
        return new v2(this.x - that.x, this.y - that.y);
    }

    scale(scalar) {
        return new v2(this.x * scalar, this.y * scalar);
    }

    len() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalise() {
        const n = this.len();
        return new v2(this.x / n, this.y / n);
    }

    dist(that) {
        return this.sub(that).len();
    }
}

// Polar Coordinates

function polarCoord(mag, dir) {
    return new v2(Math.cos(dir) * mag, Math.sin(dir) * mag);
}

// Tracking Key State - prevents object flying off the screen

const keyState = {
    'KeyW': false,
    'KeyS': false,
    'KeyA': false,
    'KeyD': false,
};

// Object Direction

const directionMap = {
    'KeyW': new v2(0, -1),
    'KeyS': new v2(0, 1),
    'KeyA': new v2(-1, 0),
    'KeyD': new v2(1, 0),
    // 'Space': new v2()
};

// Particles - colour comes from rgba + particleAlpha (replaced by Colour class methods)

class Particle {
    constructor(pos, vel, lifetime, radius, colour) {
        this.pos = pos;
        this.vel = vel;
        this.lifetime = lifetime;
        this.radius = radius;
        this.colour = colour;
    }

    render(camera) {
        const particleAlpha = this.lifetime / particleLifetime;
        camera.fillCircle(this.pos, this.radius, this.colour.withAlpha(particleAlpha));
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
        this.lifetime -= dt;
    }
}

function particleBurst(particles, centre, colour) {
    const particleLength = Math.random() * particleCount;
    for (let i = 0; i < particleLength; i++) {
        particles.push(new Particle(
            centre,
            polarCoord(
                Math.random() * particleMagnitude,
                Math.random() * 2 * Math.PI),
            Math.random() * particleLifetime,
            (Math.random() * particleRadius) + 5,
            colour
        ));
    }
}

// Tutorial State Class

const tutorialState = Object.freeze({
    learningToMove: 0,
    learningToShoot: 1,
    finishedLearning: 2
});

const tutorialMessages = Object.freeze([
    "'W', 'S', 'A' or 'D' to move around.",
    "'LEFT MOUSE CLICK' to shoot.",
    ""
]);

class Tutorial {
    constructor() {
        this.state = 0;
        this.popup = new TutorialPopup(tutorialMessages[this.state]);
        this.popup.fadeIn();

        this.popup.onFadedOut = () => {
            this.popup.text = tutorialMessages[this.state];
            this.popup.fadeIn();
        };
    }

    update(dt) {
        this.popup.update(dt);
    }

    render(camera) {
        this.popup.render(camera);
    }

    playerMoved() {
        if (this.state == tutorialState.learningToMove) {
            this.popup.fadeOut();
            this.state += 1;
        }
    }

    playerShot() {
        if (this.state == tutorialState.learningToShoot) {
            this.popup.fadeOut();
            this.state += 1;
        }
    }
};

// Classes

class TutorialPopup {
    constructor(text) {
        this.alpha = 0.0;
        this.dalpha = 0.0;
        this.text = text;
        this.onFadedOut = undefined;
        this.onFadedIn = undefined;
    }

    update(dt) {
        this.alpha += this.dalpha * dt;

        if (this.dalpha < 0.0 && this.alpha <= 0.0) {
            this.dalpha = 0.0;
            this.alpha = 0.0;

            if (this.onFadedOut !== undefined) {
                this.onFadedOut();
            }

        } else if (this.dalpha > 0.0 && this.alpha >= 1.0) {
            this.dalpha = 0.0;
            this.alpha = 1.0;

            if (this.onFadedIn !== undefined) {
                this.onFadedIn();
            }
        }
    }

    render(camera) {
        camera.fillMessage(this.text, messageColour.withAlpha(this.alpha));
    }

    fadeIn() {
        this.dalpha = 1.0;
    }

    fadeOut() {
        this.dalpha = -1.0;
    }
}

// Enemies

class Enemy {
    constructor(pos) {
        this.pos = pos;
        this.dead = false;
    }

    update(dt, followPos) {
        let vel = followPos
            .sub(this.pos)
            .normalise()
            .scale(enemySpeed * dt);
        this.pos = this.pos.add(vel);
    }

    render(camera) {
        camera.fillCircle(this.pos, enemyRadius, enemyColour);
    }
}

// Bullets

class Bullet {
    constructor(pos, vel) {
        this.pos = pos;
        this.vel = vel;
        this.lifetime = bulletLifetime;
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
        this.lifetime -= dt;
    }

    render(camera) {
        camera.fillCircle(this.pos, bulletRadius, bulletColour.withAlpha(0.8));
    }
}

// Player class

class Player {
    health = playerMaxHealth;
    trail = [];

    constructor(pos) {
        this.pos = pos;
    }

    render(camera) {
        const n = this.trail.length;

        // Trail cones towards the end

        for (let i = 0; i < n; i++) {
            camera.fillCircle(this.trail[i].pos, playerRadius * (i / n), playerColour.withAlpha(this.trail[i].alpha)); // rev lerp (i / n)
        }

        if (this.health > 0) {
            camera.fillCircle(this.pos, playerRadius, playerColour);
        }
    }

    update(dt, vel) {
        this.pos = this.pos.add(vel.scale(dt));

        // Shows player trail for camera reference

        this.trail.push({
            pos: this.pos,
            alpha: 0.75,
        });

        for (let dot of this.trail) {
            dot.alpha -= playerTrailFadoutRate * dt;
        }

        this.trail = this.trail.filter(x => x.alpha > 0.0);
    }

    shoot(target) {
        const bulletDir = target
            .sub(this.pos)
            .normalise();
        const bulletVel = bulletDir.scale(bulletSpeed);
        const bulletPos = this.pos.add(bulletDir.scale(playerRadius + bulletRadius));

        // Render audio trigger

        const now = performance.now() / 1000;
        if (now - lastGunfireTime > gunfireCooldown) {
            audioPlay('assets/sfx/m4_suppressed.mp3');
            lastGunfireTime = now;
        }

        return new Bullet(bulletPos, bulletVel); // create new bullet instance, add it to bullets
    }

    damage(value) {
        this.health = Math.max(this.health - value, 0.0);

        // Sfx Render

        const now = performance.now() / 1000;
        if (this.health > 1 && now - lastHitTime > hitCooldown) {
            audioPlay('assets/sfx/player_hit.mp3');
            lastHitTime = now;
        }
    }

    heal(value) {
        this.health = Math.min(this.health + value, playerMaxHealth);
    }
}

// Game

class Game {
    constructor(context) {
        this.player = new Player(new v2(0, 0));
        this.score = 0;
        // this.mousePos = new v2(0, 0);
        this.vel = new v2(0, 0);
        this.tutorial = new Tutorial();
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.enemySpawnRate = enemySpawnCooldown;
        this.enemySpawnCooldown = this.enemySpawnRate;
        this.paused = false;

        this.camera = new Camera(context);

        canvas.addEventListener('keyup', (event) => this.keyUp(event));
        canvas.addEventListener('keydown', (event) => this.keyDown(event));
    }

    update(dt) {
        if (this.paused) {
            return;
        }

        // Bullet time

        if (this.player.health <= 0.0) {
            dt /= 50;
        }

        // Update camera

        this.camera.setTarget(this.player.pos);
        this.camera.update(dt);

        this.player.update(dt, this.vel);
        this.tutorial.update(dt);

        for (let bullet of this.bullets) {
            bullet.update(dt);
        }

        this.bullets = this.bullets.filter((bullet) => bullet.lifetime > 0.0);

        for (let particle of this.particles) {
            particle.update(dt);
        }

        this.particles = this.particles.filter((particle) => particle.lifetime > 0.0);

        for (let enemy of this.enemies) {
            if (!enemy.dead) {
                for (let bullet of this.bullets) {
                    if (enemy.pos.dist(bullet.pos) <= bulletRadius + enemyRadius) {
                        this.score += enemyKillScore;
                        this.player.heal(enemyKillHealer);
                        enemy.dead = true;
                        bullet.lifetime = 0;
                        particleBurst(this.particles, enemy.pos, enemyColour);
                    }
                }
            }

            // Damage player

            if (this.player.health > 0 && !enemy.dead) {
                if (enemy.pos.dist(this.player.pos) <= playerRadius + enemyRadius) {
                    this.player.damage(enemyDamage);
                    if (this.player.health <= 0) {
                        globalFillFilter = grayScaleFilter;

                        // Death Sfx

                        const now = performance.now() / 1000;
                        if (now - lastDeathTime > deathCooldown) {
                            audioPlay('assets/sfx/player_death.mp3');
                            lastDeathTime = now;
                        }
                    }
                    enemy.dead = true;
                    particleBurst(this.particles, enemy.pos, playerColour);
                }
            }
        }

        for (let enemy of this.enemies) {
            enemy.update(dt, this.player.pos);
        }

        this.enemies = this.enemies.filter(enemy => !enemy.dead);

        // Spawning Enemies

        if (this.tutorial.state == tutorialState.finishedLearning) {
            this.enemySpawnCooldown -= dt;
            if (this.enemySpawnCooldown <= 0) {
                this.spawnEnemy();
                this.enemySpawnCooldown = this.enemySpawnRate;
                this.enemySpawnRate = Math.max(0.01, this.enemySpawnRate - 0.01);
            }
        }
    }

    // Render Entities

    renderEntities(entities) {
        for (let entity of entities) {
            entity.render(this.camera);
        }
    }

    render() {
        const width = this.camera.width();
        const height = this.camera.height();
        // Makes BG transparent - BG colour can now be changed in CSS
        this.camera.clear();
        // Draw Circle
        this.player.render(this.camera);

        this.renderEntities(this.bullets);
        this.renderEntities(this.particles);
        this.renderEntities(this.enemies);

        // Prevent tutorial render if paused
        if (this.paused) {
            // Instructions
            this.camera.fillMessage("Game paused, press 'SPACE' to resume", messageColour);
        } else if (this.player.health <= 0) {
            this.camera.fillMessage("Fading into oblivion, 'F5 (Win) or CMD+R (Mac)' to restart", enemyColour);
        } else {
            this.tutorial.render(this.camera);
        }

        // Health bar render
        this.camera.fillRect(width / 4, height - height / 13, (globalWidth / 2) * (this.player.health / playerMaxHealth), healthBarHeight, healthBarColour.withAlpha(0.9));
        this.camera.strokeRect(width / 4, height - height / 13, globalWidth / 2, healthBarHeight, messageColour.withAlpha(0.9)); // frame

        // Score render
        this.camera.scoreText(width / 2, height / 13, `SCORE: ${this.score}`, messageColour.withAlpha(0.5));
    }

    spawnEnemy() {
        let dir = Math.random() * 2 * Math.PI;
        this.enemies.push(new Enemy(this.player.pos.add(polarCoord(enemySpawnDistance, dir))));
    }

    togglePause() {
        this.paused = !this.paused;
        if (this.paused) {
            globalFillFilter = grayScaleFilter;
        } else {
            globalFillFilter = idFilter;
        }
    }

    keyDown(event) {
        if (event.code in directionMap && !keyState[event.code]) {
            keyState[event.code] = true; // Set key state to pressed
            this.vel = this.vel.add(directionMap[event.code].scale(playerSpeed));
            this.tutorial.playerMoved();
        } else if (event.code === 'Space') {
            this.togglePause();
        }
    }

    keyUp(event) {
        if (event.code in directionMap) {
            keyState[event.code] = false; // Set key state to not pressed
            this.vel = this.vel.sub(directionMap[event.code]);
            this.tutorial.playerMoved();

            // Reset the corresponding velocity component to zero else it compounds
            if (event.code === 'KeyW' || event.code === 'KeyS') {
                this.vel.y = 0; // Reset vertical velocity
            } else if (event.code === 'KeyA' || event.code === 'KeyD') {
                this.vel.x = 0; // Reset horizontal velocity
            }
        }
    }

    mouseDown(event) {
        if (this.paused) {
            return;
        }

        // if the player dies stop shooting

        if (this.player.health <= 0) {
            return;
        }

        this.tutorial.playerShot();
        const mousePos = new v2(event.clientX, event.clientY); // client works better than screen
        this.bullets.push(this.player.shoot(this.camera.toWorld(mousePos)));
    }
}

const game = new Game(context);

// Animation Frames - Event Loop

let start;

function step(timestamp) {
    if (start === undefined) {
        start = timestamp;
    }
    const dt = (timestamp - start) / 1000;
    start = timestamp;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    game.update(dt);
    game.render(); // the game has it's context inside the camera

    window.requestAnimationFrame(step);
}
window.requestAnimationFrame(step);

document.addEventListener('mousedown', (event) => {
    game.mouseDown(event);
});