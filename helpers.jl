using BSON:@save, @load

function save_model(model::nn)
  base_wt = cpu.(Tracker.data.(params(model.base)))
  val_wt = cpu.(Tracker.data.(params(model.value)))
  adv_wt = cpu.(Tracker.data.(params(model.adv)))

  @save "models/duel_dqn_base" base_wt
  @save "models/duel_dqn_val" val_wt
  @save "models/duel_dqn_adv" adv_wt

  println("Model saved")
end

function load_model()
  @load "models/duel_dqn_base" base_wt
  @load "models/duel_dqn_val" val_wt
  @load "models/duel_dqn_adv" adv_wt

  Flux.loadparams!(base, base_wt)
  Flux.loadparams!(adv, adv_wt)
  Flux.loadparams!(value, val_wt)

  return nn(base, value, adv)
end
