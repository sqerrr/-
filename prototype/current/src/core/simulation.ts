  private orbitSystem!: OrbitSystem;
  private deathResolution!: DeathResolutionSystem;
  private delayedStrikeSystem!: DelayedStrikeSystem;
  private physicalActivations!: PhysicalActivationSystem;
  private canonicalSerializer = new CanonicalStateSerializer();
  private snapshotBuilder = new SnapshotBuilder();
  private activationPipeline!: ActivationPipelineSystem;
  private physicalCatalysts!: PhysicalCatalystSystem;
  private relicRace!: RelicRaceSystem;
  private rewardOfferFactory!: RewardOfferFactory;
  private progressionOffers!: ProgressionOfferSystem;
  private poiSystem!: PoiSystem;
  private phenomenonCasts!: PhenomenonCastSystem;
  private phenomenonKillReactions!: PhenomenonKillReactionSystem;
  private playerDamage!: PlayerDamageSystem;
  private playerGrowth!: PlayerGrowthSystem;
  private playerMovement!: PlayerMovementSystem;
  private statefulPhenomenonCasts!: StatefulPhenomenonCastSystem;
  private nextId = 1;
  private entityStore = new EntityStore();
  /** Compatibility view for deterministic iteration and legacy regression fixtures. */
  private get ents(): Ent[] { return this.entityStore.all; }
  private set ents(value: Ent[]) { this.entityStore.replace(value); }
  private pickups: Pickup[] = [];
  /** Compatibility view; ground relic ownership lives in RelicRaceSystem. */
  private get relics(): Relic[] { return this.relicRace.all; }
  private set relics(value: Relic[]) { this.relicRace.replace(value); }
  private get relicAcc(): number { return this.relicRace.accumulatorValue; }
  private set relicAcc(value: number) { this.relicRace.accumulatorValue = value; }
  private relicRng!: Rng;
  /**
   * Items physically captured by elites become knowledge of the enemy ecosystem.
   * Later elites inherit a sample; the final Warden inherits the whole history.
   */
  private eliteLegacyItems: ItemId[] = [];
  /** Autonomous enemy growth is a separate history from physically contested relic captures. */
  private eliteEvolutionHistory: ItemId[] = [];
  /** Compatibility views; persistent hero-growth state is owned by PlayerGrowthSystem. */
  get heldItems(): ItemId[] { return this.playerGrowth.heldItems; }
  set heldItems(value: ItemId[]) { this.playerGrowth.heldItems = value; }
  private get itemDamageMul() { return this.playerGrowth.itemDamageMul; }
  private set itemDamageMul(value: number) { this.playerGrowth.itemDamageMul = value; }
  private get itemCrit() { return this.playerGrowth.itemCrit; }
  private set itemCrit(value: number) { this.playerGrowth.itemCrit = value; }
  private get itemSiphon() { return this.playerGrowth.itemSiphon; }
  private set itemSiphon(value: number) { this.playerGrowth.itemSiphon = value; }
  private get itemEliteDamageMul() { return this.playerGrowth.itemEliteDamageMul; }
  private set itemEliteDamageMul(value: number) { this.playerGrowth.itemEliteDamageMul = value; }
  private get itemDamageTakenMul() { return this.playerGrowth.itemDamageTakenMul; }
  private set itemDamageTakenMul(value: number) { this.playerGrowth.itemDamageTakenMul = value; }
  private get itemRefusalDamageMul() { return this.playerGrowth.itemRefusalDamageMul; }
  private set itemRefusalDamageMul(value: number) { this.playerGrowth.itemRefusalDamageMul = value; }
  private get itemBarrierOnEliteKill() { return this.playerGrowth.itemBarrierOnEliteKill; }
  private set itemBarrierOnEliteKill(value: number) { this.playerGrowth.itemBarrierOnEliteKill = value; }
  private get itemXpMul() { return this.playerGrowth.itemXpMul; }
  private set itemXpMul(value: number) { this.playerGrowth.itemXpMul = value; }
  private get itemCoreBonus() { return this.playerGrowth.itemCoreBonus; }
  private set itemCoreBonus(value: number) { this.playerGrowth.itemCoreBonus = value; }
  private get itemRelicRateMul() { return this.playerGrowth.itemRelicRateMul; }
  private set itemRelicRateMul(value: number) { this.playerGrowth.itemRelicRateMul = value; }
  private get dashCooldownMul() { return this.playerGrowth.dashCooldownMul; }
  private set dashCooldownMul(value: number) { this.playerGrowth.dashCooldownMul = value; }
  private get dashIFrameMul() { return this.playerGrowth.dashIFrameMul; }
  private set dashIFrameMul(value: number) { this.playerGrowth.dashIFrameMul = value; }
  // D34 asked for twenty or more relics across a run of roughly eight minutes.
  static readonly RELIC_INTERVAL = RelicRaceSystem.INTERVAL;
  static readonly RELIC_REACH = RelicRaceSystem.HERO_REACH;
  static readonly RELIC_ELITE_REACH = RelicRaceSystem.ELITE_REACH;
  private fields: Field[] = [];
  private constructs: Construct[] = [];
  private projectiles: Projectile[] = [];
  private delayedStrikes: DelayedStrike[] = [];
  private readonly world = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
  // D20 asks for a semi-open arena: islands of blockers, never corridors and never
  // an empty field. Circles cluster into organic islands and give free sliding, which
  // boxes would not. Laid out from a stream of its own so the roll cannot shift combat.
  /** Compatibility view; obstacle ownership and spatial indexing live in WorldGeometrySystem. */
  private get obstacles(): Obstacle[] { return this.worldGeometry.all; }
  private set obstacles(value: Obstacle[]) { this.worldGeometry.replace(value); }
  private worldRng!: Rng;
  private static readonly OBSTACLE_CELL = WorldGeometrySystem.OBSTACLE_CELL;
  static readonly HERO_BODY_RADIUS = 0.42;
  /** Compatibility view; POI ownership lives in PoiSystem. */
  private get pois(): Poi[] { return this.poiSystem.all; }
  private set pois(value: Poi[]) { this.poiSystem.replace(value); }
  private bossSpawned = false;
  private bossDefeated = false;
  private skillsRuntime = new Map<SkillId, SkillRuntime>();
  private catalystRuntime = new Map<CatalystId, CatalystRuntime>();
  private beatAcc = 0;
  /**
   * Compatibility aliases keep public tuning/tests stable while PlayerMovementSystem owns
   * dash timing and velocity state.
   */
  static readonly DASH_SPEED = PlayerMovementSystem.DASH_SPEED;
  static readonly DASH_DURATION = PlayerMovementSystem.DASH_DURATION;
  static readonly DASH_IFRAMES = PlayerMovementSystem.DASH_IFRAMES;
  static readonly DASH_COOLDOWN = PlayerMovementSystem.DASH_COOLDOWN;
  private get dashUntil() { return this.playerMovement.dashUntil; }
  private set dashUntil(value: number) { this.playerMovement.dashUntil = value; }
  private get dashIFramesUntil() { return this.playerMovement.dashIFramesUntil; }
  private set dashIFramesUntil(value: number) { this.playerMovement.dashIFramesUntil = value; }
  private get dashReadyAt() { return this.playerMovement.dashReadyAt; }
  private set dashReadyAt(value: number) { this.playerMovement.dashReadyAt = value; }