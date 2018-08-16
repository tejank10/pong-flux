using Blink, WebIO, JSExpr

mutable struct Vector_
    x
    y
end
Base.:+(a::Vector_, b::Vector_) = Vector_(a.x + b.x, a.y + b.y)
Base.:*(a::Vector_, b::Vector_) = Vector_(a.x * b.x, a.y * b.y)

mutable struct Ball
    pos::Vector_
    speed::Vector_
    height::Int
    width::Int
end

mutable struct Paddle
    pos::Vector_
    speed::Vector_
    height::Int
    width::Int
    step::Int
end

Rect = Union{Ball,Paddle}

mutable struct Board
    height::Int
    width::Int
    ball::Ball
    paddles::NTuple{2,Paddle}
end

mutable struct Screen
    w::Blink.Window
    data::WebIO.Observable{Dict{Any,Any}}
    out::Channel{Int}
end

mutable struct PongEnv
    board::Board
    scores::Array{Int}
    screen::Union{Screen,Void}
end

state(p::PongEnv) = draw(p.board)

function draw(b::Board)
    c = zeros(UInt8, b.height, b.width)
    draw(b, c)
end

function draw(b::Board, c)
    c = draw(b.ball, c)
    for i=1:2
        c = draw(b.paddles[i], c)
    end
    return c
end

function draw(b::Rect, c)
    w, h = size(c)
    for dy=1:b.height
        for dx=1:b.width
            !inside(b.pos.x + dx - 1, b.pos.y + dy - 1, 1, 1, w, h) && continue
            c[Int(floor(b.pos.x + dx - 1)), Int(floor(b.pos.y + dy - 1))] = UInt8(1)
        end
    end
    return c
end

inside(x,y, a, b, w, h) = !(x >= w + a || y >= h + b || x < a || y < b)

function step!(f, env::PongEnv, s, a)
    player_action(env.board, a == 2 ? -1: a == 3? 1 : 0 )
    opponent_action(env.board)
    move(env.board)
    rebound(env.board)

    r = reward(env.board.ball, env.board)
    if r == 1
        env.scores[2] += 1
    elseif r == -1
        env.scores[1] += 1
    end

    s′ = state(env)

    if condA(env) && !condB(env)
        reset!(env.board.ball, env.board)
    end
    return f(r, s′)
end

function player_action(b::Board, dir)
    set_dir(b.paddles[2], dir)
end

function opponent_action(b::Board)
    paddle = b.paddles[1]
    ball = b.ball
    dir = sign(b.ball.pos.y - paddle.height/2 - paddle.pos.y)

    if (sign(ball.pos.x - paddle.pos.x) == sign(ball.speed.x)) ||
     (ball.pos.y >= paddle.pos.y && ball.pos.y <= paddle.pos.y + paddle.height)
      dir = 0
    end

    set_dir(b.paddles[1], dir)
end

function set_dir(p::Paddle, dir)
    p.speed = Vector_(0, dir*p.step)
end

function move(b::Board)
    move(b.ball)
    move(b.paddles[1], b)
    move(b.paddles[2], b)
end

move(b::Rect) = (b.pos = b.pos + b.speed)

function move(b::Paddle, board::Board)
    b.pos = b.pos + b.speed
    if b.pos.y < 0
        b.pos.y = 0
    elseif b.pos.y + b.height > board.height
        b.pos.y = board.height - b.height;
    end
end

function rebound(b::Board)
    for i in b.paddles
        if hit(i, b.ball)
            rebound(b.ball, i)
            break;
        end
    end

    if b.ball.pos.y <= 0 || b.ball.pos.y + b.ball.height > b.height
        b.ball.speed = b.ball.speed * Vector_(1, -1)
    end
end

hit(paddle::Paddle, ball::Ball) =
  (ball.pos.x + ball.width >= paddle.pos.x &&
   ball.pos.y + ball.height >= paddle.pos.y &&
   ball.pos.x < paddle.pos.x + paddle.width &&
   ball.pos.y < paddle.pos.y + paddle.height)


function rebound(ball::Ball, paddle::Paddle)
    diff = paddle.pos.y + paddle.height/2 - ball.pos.y - ball.height/2;
	rebound(ball, Vector_(-1, 1))
	ball.speed.x += sign(ball.speed.x);
	ball.speed.y = -1 * ball.speed.x*diff/paddle.height;
end

rebound(b::Ball, v::Vector_) = (b.speed = b.speed * v)

function reward(ball::Ball, board::Board)
    ball.pos.x < 0 && return 1
    ball.pos.x > board.width && return -1
    return 0
end

condA(env::PongEnv) = env.board.ball.pos.x <= 0 || env.board.ball.pos.x > env.board.width;
condB(env::PongEnv) = env.scores[1] >= 20 || env.scores[2] >= 20

Base.done(env::PongEnv) = condB(env)

function reset!(env::PongEnv)
    env.scores = [0,0]
    reset!(env.board.ball, env.board)
    reset!(env.board.paddles[1], env.board)
    reset!(env.board.paddles[2], env.board)
end

function reset!(ball::Ball, board::Board)
    ball.pos.x = floor(board.width/2);
	ball.pos.y = floor(board.height/2);
	k = -1 * sign(ball.speed.x);
	ball.speed.x = k*5;
	ball.speed.y = -1 * k * rand(-5:5);
end

function reset!(paddle::Paddle, board::Board)
    paddle.pos.y = floor(board.height/2)
end

function PongEnv(web=false)
    factor = 6
    width = 80
    height = 80
    w = width * factor
    h = height*factor
    ball = Ball(Vector_(floor(w/2), floor(h/2)), Vector_(-5, -1), 2*factor, factor)
    paddle_a = Paddle(Vector_(8*factor, floor(h/2)), Vector_(0, 0), 8*factor, 2*factor, 2*factor)
    paddle_b = Paddle(Vector_(w - 2*factor - 8*factor, floor(h/2)),Vector_(0, 0), 8*factor, 2*factor, 2*factor)
    s = web ? Screen() : nothing
    PongEnv(Board(w, h, ball, (paddle_a, paddle_b)), [0, 0], s)
end

function render(env::PongEnv, c::Array{UInt8,2})
    env.screen != nothing && (
        return render(env.screen, Dict(
            "scores"=> env.scores,
            "state"=> c
        ))
    )
    s = Array{String}(size(c)...)
    s[c .== 0] = " "
    s[c .== 1] = "|"
    w, h = size(s)
    for i=1:h
        for j=1:w
            print(s[j,i,1])
        end
        print("\n")
    end
end

function Screen()
    w = Blink.Window();
    s = Scope()
    data = Observable(s, "data", Dict())
    catch_ = Observable(s, "catch", 0)
    out = Channel{Int}(1)
    s(dom"div"(
        dom"canvas[width=480,height=480]"(),
        dom"div"(
            dom"label"("Scores:"),
            dom"input.score[readonly=true,value=0]"(),
            dom"input.score[readonly=true,value=0]"(),
        )
    ))
    onimport(s, js"""function(){
        var _ = (e) => document.querySelector(e);
        var __ = (e) => document.querySelectorAll(e);
        document.body.style.backgroundColor='#000';
        document.body.style.color='#fff';
        __('.score').forEach(e => e.style.display='block');
        console.log('eee')
        function draw({state, scores}){
            var canvas = _('canvas');
            var width = canvas.width;
            var height = canvas.height;
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width,canvas.height);
            var arr = new Array(width*height*4).fill(0);
            state.forEach((e, i) =>{
                e.forEach((y, j) => {
                    if(y){
                        var h = j*4 + i*4*width;
                        for (var l = 0; l<4; l++){
                            arr[h + l] = 255;
                        }
                    }
                });
            });
            var imgData = new ImageData((new Uint8ClampedArray(arr)), width, height);
            ctx.putImageData(imgData,0, 0);
            __('.score').forEach((e,i) => e.value = scores[i]);
        }
        this.draw = draw
    }""")

    onjs(data, JSExpr.@js x -> begin
        $catch_[] = Date.now()
        this.draw(x)
    end)

    on(catch_) do x
        put!(out, x)
    end
    Blink.body!(w, s)
    sleep(1)
    Screen(w, data, out)
end

function render(s::Screen, val)
    s.data[] = val
    take!(s.out)
end
