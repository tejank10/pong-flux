// general helper
(function(obj){



function Vector(x, y){
	this.x = x;
	this.y = y;

	this.add = (other)=>{
		this.x += other.x;
		this.y += other.y;
	}
}

function randColor(){
	return "#" + Math.floor(Math.random()*999);
}

function show(ele){
	if(ele.className.match(" hidden") != null){
		ele.className = ele.className.replace(" hidden", "");
	}
}

function hide(ele){
	if(ele.className.match(" hidden") == null){
		ele.className += " hidden";
	}
}

var $$ = (s)=>document.querySelector(s);

function highlight(el, container){
	var old = container.querySelector('.selected');
	if( old != el){
		if(old)
			old.className = old.className.replace("selected", "");
		el.className += " selected";
	}
}

Object.assign(obj, {Vector, show, hide, highlight, $$})
})(window);

/******************************************************
=======================================================
Ball
=======================================================
******************************************************/

(function(obj){
	Object.assign(obj, {Ball})

	function Ball(pos, speed, {color="#00f", radius=10}={}){
		this.pos = pos;
		this.speed = speed;
		this.radius = radius;
		this.color = color;
	}

	Ball.prototype.draw = function (canvas) {
		var ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.fillStyle = this.color;
		ctx.arc(this.pos.x, this.pos.y, this.radius, 0, 2*Math.PI);
		ctx.fill();
	}

	Ball.prototype.move = function () {
		this.pos.add(this.speed);
	}

	Ball.prototype.detectCollision = function (width, height) { // with top, left & right walls
		var collisions = [];
		if(this.pos.x - this.radius <= 0 || this.pos.x + this.radius >= width)collisions.push([-1, 1]);
		if(this.pos.y - this.radius <= 0)collisions.push([1, -1]);

		return collisions;
	}

	Ball.prototype.rebound = function ([mx, my]) {
		this.speed.x *= mx;
		this.speed.y *= my;
	}

})(window);

/******************************************************
=======================================================
Paddle
=======================================================
******************************************************/

(function(obj){
	Object.assign(obj,{Paddle})

	function Paddle(pos, {color="#f00", width=50, height=10, total_width, total_height, speed=10}={}){
		this.pos = pos;
		this.dir = 0;
		this.speed = speed;
		this.total_width = total_width;
		this.total_height = total_height;
		this.width = width;
		this.height = height;
		this.color= color;
	}

	Paddle.prototype.draw = function (canvas) {
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = this.color;
		ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}

	Paddle.prototype.move = function () {
		this.pos.add(new Vector(this.dir*this.speed, 0));
		if(this.pos.x < 0)this.pos.x = 0;
		else if(this.pos.x + this.width > this.total_width) this.pos.x = this.total_width - this.width;
	}

	Paddle.prototype.detectCollision = function(ball){
		if(ball.pos.x + ball.radius >= this.pos.x && ball.pos.y + ball.radius >= this.pos.y && ball.pos.x - ball.radius <= this.pos.x + this.width && ball.pos.y <= this.pos.y + this.height){
			return this
		}
		return null
	}

	Paddle.prototype.setDirection = function (d) {this.dir = d;}

	Paddle.prototype.rebound = function (ball) {
		var diff = this.pos.x + this.width/2 - ball.pos.x;
		ball.rebound([-1, 1]);
		ball.speed.y += Math.sign(ball.speed.y);
		ball.speed.x = ball.speed.y*diff/this.width;

	}

})(window);

/******************************************************
=======================================================
Pong Game
=======================================================
******************************************************/

(function(obj){

function Pong(playground,{width=500, height=400, paddle_width=10, paddle_height=50, paddle_speed=10, ball_width=1, ball_height=2, paddle_margin=8}={}){
	var score = 0;

	var screen = document.createElement('canvas');
	var background = document.createElement('canvas');

	var x = [background, screen]

	x.forEach(e =>{
		e.width = width;
		e.style.width = width + "px";
		e.height = height;
		e.style.height = height + "px";
		playground.appendChild(e)
	})

	var components = {

		paddles: new PaddleCollection(
			[
				new Vector(paddle_margin, Math.floor(height/2)),
				new Vector(width-paddle_width - paddle_margin, Math.floor(height/2))
			], {
			width:paddle_width,
			height:paddle_height,
			total_height: height,
			paddle_speed,
			color: "#fff"
		}),
		ball: new HyperBall(new Vector(Math.floor(width/2), Math.floor(height/2)), new Vector(-5, -1), {width:ball_width, height: ball_height, color: "#fff"})
	}

	var paddleController = new PaddleController(components.paddles.collection[0]);
	this.paddleController = paddleController;
	this.ball = components.ball;

	this.draw = ()=>{
		var ctx = background.getContext('2d');
		//background
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, background.width, background.height);

		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.setLineDash([10, 15]);
		ctx.moveTo(width/2, 0);
		ctx.lineTo(width/2, height);
		ctx.stroke();

		screen.getContext('2d').clearRect(0, 0, screen.width, screen.height)
		for( var c in components){
			components[c].draw(screen);
		}

		ctx.fillStyle = "#fff";
		ctx.font = "48px sans-serif"
		ctx.textBaseline = "top";
		ctx.textAlign = "right";
		ctx.fillText(components.paddles.collection[0].score, width/2 - 20, 20);
		ctx.textAlign = "left";
		ctx.fillText(components.paddles.collection[1].score, width/2 + 20, 20);
	}


	this.play = ()=>{
		score += this.step();
		if(!this.done())
			requestAnimationFrame(this.play);
	}

	this.step = ({id, dir})=>{
		components.ball.move();

		this.action(id, dir);
		this.movePaddles();

		this.collisionDetector();

		if(components.ball.pos.x < 0) {
			components.paddles.incScore(1);
			return 1;
		}
		if(components.ball.pos.x > width){
			components.paddles.incScore(0);
			return -1;
		}
		return 0;
	}

	this.collisionDetector = function(){
		var ball = components.ball;

		var paddleHit = components.paddles.detectCollision(ball); // collision with paddle
		if(paddleHit){
			paddleHit.rebound(ball);
		}
		var wallHit = components.ball.detectCollision(width, height); // collision with walls
		wallHit.forEach(w=> ball.rebound(w));

	}

	this.condA = () => components.ball.pos.x < 0 || components.ball.pos.x > width;
	this.condB = () => components.paddles.collection.reduce((a, e)=> (e.score == 20) || a, false);

	this.done = function(){
		return this.condA() && this.condB();
	}

	this.movePaddles = ()=> components.paddles.move();

	this.action = (id, dir)=>{
		// console.log(id, dir)
		components.paddles.setDirection(id, dir);
	}

	this.resetBall = function(){
		components.ball.reset(width, height)
	}

	this.reset = () => {
		components.paddles.reset();
	}

	this.render = this.draw;

	this.state = function(){
		var n = 80;
		var hidden = document.createElement('canvas');
		hidden.width = n;
		hidden.height = n;
		hidden.getContext('2d').drawImage(screen, 0, 0, hidden.width, hidden.height);
		var imgData = hidden.getContext('2d').getImageData(0, 0, hidden.width, hidden.height);
		var d = [];
		for(var i = 0; i< n*n; i++){
			d.push(imgData.data[i*4 + 3] == 255 ? 1 : 0);
		}
		return d
	}

	this.config = ()=>{
		return {state: this.state()};
	};
}

Object.assign(obj, {Pong})

})(window);;

/******************************************************
=======================================================
Components
=======================================================
******************************************************/

(function(obj){

Object.assign(obj, {PaddleCollection, HyperBall, PaddleController})

function PaddleCollection(positions, config){
	this.collection = positions.map(e=>new Paddle(e, config));

	this.move = ()=>{
		this.collection.forEach(p => p.move());
	}

	this.setDirection = (id, dir)=>{
		this.collection[id].setDirection(dir);
	}

	this.detectCollision = (ball)=>{
		for (var paddle of this.collection)
			if(paddle.detectCollision(ball))return paddle;

		return null;
	}

	this.draw = (canvas)=>{
		this.collection.forEach(paddle=>paddle.draw(canvas));
	}

	this.incScore = (id)=>{
		this.collection[id].score += 1;
	}

	this.reset = () =>{
		this.collection.forEach((e, i) => {
			e.score = 0
			e.pos = positions[i];
		})
	}
}


function PaddleController(paddle){

	this.next = (ball)=>{
		if(Math.sign(ball.pos.x - paddle.pos.x) == Math.sign(ball.speed.x))return 0;  // ball is moving away

		if(ball.pos.y >= paddle.pos.y && ball.pos.y <= paddle.pos.y + paddle.height){
			// return paddle.setDirection(0)
			return 0;
		}

		var dir = Math.sign(ball.pos.y - paddle.height/2 - paddle.pos.y);
		// paddle.setDirection(dir);
		return dir;
	}
}

function HyperBall(pos, speed, {color="#00f", width=1, height=2}={}){
	this.pos = pos;
	this.speed = speed;
	this.width = width;
	this.height = height;
	this.color = color;
}

HyperBall.prototype = Object.create(Ball.prototype)

var hype = HyperBall.prototype;

hype.draw = function (canvas) {
	var ctx = canvas.getContext('2d');
	ctx.beginPath();
	ctx.fillStyle = this.color;
	ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
}

hype.detectCollision = function(width, height) { // with top & bottom walls
	var collisions = [];
	if(this.pos.y <= 0 || this.pos.y + this.height > height)collisions.push([1, -1]);
	return collisions;
};

hype.reset = function(width, height){
	this.pos.x = Math.floor(width/2);
	this.pos.y = Math.floor(height/2);
	var k = -1 * Math.sign(this.speed.x);
	this.speed.x = k*10;
	this.speed.y = -1 * k;
}


/*** overriding a few functions ***/

Paddle.prototype.move = function (){
	this.pos.add(new Vector(0, this.dir*this.speed));
	if(this.pos.y < 0)this.pos.y = 0;
	else if(this.pos.y + this.height > this.total_height) this.pos.y = this.total_height - this.height;
}

Paddle.prototype.detectCollision = function (ball) {
	if(ball.pos.x + ball.width >= this.pos.x && ball.pos.y + ball.height >= this.pos.y && ball.pos.x < this.pos.x + this.width && ball.pos.y < this.pos.y + this.height){
		return this
	}
	return null
}

Paddle.prototype.rebound = function (ball){
	var diff = this.pos.y + this.height/2 - ball.pos.y - ball.height/2;
	ball.rebound([-1, 1]);
	ball.speed.x += Math.sign(ball.speed.x);
	ball.speed.y = -1 * ball.speed.x*diff/this.height;
}

Paddle.prototype.score = 0;

})(window);

/******************************************************
=======================================================
Board
=======================================================
******************************************************/

(function(obj){

	function Board(container, {env}={}){
		this.container = container
		this.render	= ()=>{
			env.render();
		};
	}

  Object.assign(obj, {Board})
})(window);

/******************************************************
=======================================================
__init__
=======================================================
******************************************************/

var __init__ = (function(obj){
	console.log("__init__ called")
	var factor = 6, width = 80, height = 80;
	var $$ = (e) => document.querySelector(e)

	console.log($$(".board"))
	var env = new Pong($$("#playground"), {
		width: width*factor,
		height: height*factor,
		paddle_height: 8*factor,
		paddle_width: 2*factor,
		ball_height: 2*factor,
		ball_width: factor,
		paddle_speed: 2*factor,
		paddle_margin: 8*factor
	});
	var other = env.paddleController;
	var board = new Board($$(".board"), {env});

	board.render();

	function play(x){
			console.log("play", x)
			if(x["reset"])env.reset();
			var a = x["action"] == 2? -1 : x["action"] == 3? 1: 0
			var r = env.step({id: 1, dir: a});
			board.render()
			if(r == 0){
				var d = other.next(env.ball)
				console.log(d)
				r = env.step({id: 0, dir: d});
				board.render()
			}
			var res = {"state": env.state(), "reward": r, "done": env.done()};
			if(env.condA() && !env.condB()){
				env.resetBall()
			}
			setResult(res)
	}

	Object.assign(obj, {play, env, board})
});
