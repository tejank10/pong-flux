using WebIO, JSExpr
using Blink

# Blink.AtomShell.install()

mutable struct PongEnv
    window
    scope
    reset
    state
    action
    result
    reward
    done

    function PongEnv(test=true)
        w = Blink.Window(Dict(:show => test))
        if (test) opentools(w) end

        files = ["./lib/components.js", "./lib/style.css"]
        s = Scope(imports=files)
        s = s(
            dom"div.demo_wrapper"(
                dom"div.board"(
                    dom"div#playground"()
                )
            ))
        state_box = Channel{Array{Any,1}}(1)
        state_obs = Observable(s, "get_state", [])
        action = Observable(s, "action", Dict{String,Any}())
        result_obs = Observable(s, "result", Dict{Any,Any}())
        result_box = Channel{Dict}(1)

        onimport(s, JSExpr.@js () -> begin
            __init__(window);
            $state_obs[] = env.state()

            function setResult(res)
                $result_obs[] = res;
            end
            window.setResult = setResult
        end)

        on(state_obs) do s
            put!(state_box, s)
        end
        on(result_obs) do r
            put!(result_box, r)
        end
        onjs(action, JSExpr.@js x -> begin
            play(x)
        end)
        Blink.body!(w, s)
        state = take!(state_box)
        new(w, s, false, state, action, result_box, 0, false)
    end
end

function reset!(env::PongEnv)
    env.reset = true
end

state(env::PongEnv) = env.state

function step!(f, env::PongEnv, s, a)
    play(env, a)
    return f(env.reward, env.state)
end

function play(env::PongEnv, a)
    env.action[] = Dict("action"=>a, "reset"=>env.reset)
    res = take!(env.result)
    env.state = res["state"]
    env.reward = res["reward"]
    env.done = res["done"]
    env.reset = false
end

done(env::PongEnv) = env.done
