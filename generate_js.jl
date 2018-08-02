using BSON: @load
using FluxJS

include("duel-dqn.jl")

@load "models/duel_dqn_base" base_wt
@load "models/duel_dqn_val" val_wt
@load "models/duel_dqn_adv" adv_wt

Flux.loadparams!(base, base_wt)
Flux.loadparams!(adv, adv_wt)
Flux.loadparams!(value, val_wt)

model = nn(base, value, adv)

FluxJS.compile("model", model, rand(80, 80, 4, 1))
