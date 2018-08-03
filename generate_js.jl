using BSON: @load
using FluxJS

include("duel-dqn.jl")

FluxJS.compile("model", model, rand(80, 80, 4, 1))
