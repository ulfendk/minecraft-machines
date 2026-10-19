package dk.ulfen.machines.machine;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.util.GeckoLibUtil;
import dk.ulfen.machines.ModRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageTypes;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityDimensions;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * A drivable, operable construction machine. Seat 0 drives with W/A/S/D (like a boat)
 * and works up to four channels (boom, stick, bucket ...) plus an action, sent from the
 * client by {@link dk.ulfen.machines.net.MachineControlPayload}. The tools that change
 * the world live in {@link MachineTools}. Breaks like a boat when players hit it.
 */
public class MachineEntity extends Mob implements GeoEntity {
	private static final List<EntityDataAccessor<Float>> CHANNELS = List.of(
		SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.FLOAT),
		SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.FLOAT),
		SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.FLOAT),
		SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.FLOAT));
	private static final EntityDataAccessor<Float> LOAD = SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.FLOAT);
	private static final EntityDataAccessor<Integer> KIND = SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.INT);
	private static final EntityDataAccessor<Boolean> CARRY = SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.BOOLEAN);
	private static final EntityDataAccessor<Boolean> MODE = SynchedEntityData.defineId(MachineEntity.class, EntityDataSerializers.BOOLEAN);

	public final MachineSpec spec;
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);
	final Load load;

	// Input from the operator (server side), refreshed by every control packet.
	private final int[] axes = new int[4];
	private int inputAge = 100;
	private int lastAction;
	private boolean actionPending;

	// Tools (server side)
	@Nullable BlockState carriedBlock;
	@Nullable UUID carriedEntity;
	@Nullable UUID displayId;
	int concreteColour = 7; // gray
	int toolTicks;
	Vec3 lastPos = Vec3.ZERO;

	private float damage;
	private int hurtTicks;
	private int soundCooldown;

	/** driving: -reverse .. 1, ramps up and down for some inertia (client authoritative, like the movement) */
	private float throttle;

	// Client-side animation state
	public float drivenDistance;
	public float drivenSpeed;
	public float steer;
	public final float[] prevChannels = new float[4];
	public boolean tutorialShown;

	public MachineEntity(EntityType<? extends MachineEntity> type, Level level) {
		super(type, level);
		this.spec = ModRegistry.spec(type);
		this.load = new Load(Math.max(1, spec.tool.capacity));
		this.setPersistenceRequired();
		if (!spec.drives()) this.setNoGravity(true);
		for (int i = 0; i < spec.channels.size(); i++) {
			prevChannels[i] = spec.channels.get(i).rest;
			this.entityData.set(CHANNELS.get(i), spec.channels.get(i).rest);
		}
	}

	public static AttributeSupplier.Builder createAttributes(MachineSpec s) {
		return Mob.createMobAttributes()
			.add(Attributes.MAX_HEALTH, s.health)
			.add(Attributes.MOVEMENT_SPEED, s.drive.speed)
			.add(Attributes.STEP_HEIGHT, 1.1)
			.add(Attributes.KNOCKBACK_RESISTANCE, 1.0)
			.add(Attributes.CAMERA_DISTANCE, s.camera);
	}

	@Override
	protected void defineSynchedData(SynchedEntityData.Builder builder) {
		super.defineSynchedData(builder);
		for (EntityDataAccessor<Float> c : CHANNELS) builder.define(c, 0F);
		builder.define(LOAD, 0F);
		builder.define(KIND, 0);
		builder.define(CARRY, false);
		builder.define(MODE, false);
	}

	// ------------------------------------------------------------ channels

	public int channelCount() {
		return spec.channels.size();
	}

	public float channel(int i) {
		return i < channelCount() ? this.entityData.get(CHANNELS.get(i)) : 0F;
	}

	public void setChannel(int i, float value) {
		if (i >= channelCount()) return;
		MachineSpec.Channel c = spec.channels.get(i);
		if (c.wrap) value = Mth.wrapDegrees(value);
		else value = Mth.clamp(value, c.min, c.max);
		this.entityData.set(CHANNELS.get(i), value);
	}

	public float[] channels() {
		float[] v = new float[4];
		for (int i = 0; i < channelCount(); i++) v[i] = channel(i);
		return v;
	}

	public float loadFraction() {
		return this.entityData.get(LOAD);
	}

	public int loadKind() {
		return this.entityData.get(KIND);
	}

	public boolean carrying() {
		return this.entityData.get(CARRY);
	}

	public boolean mode() {
		return this.entityData.get(MODE);
	}

	void setMode(boolean on) {
		this.entityData.set(MODE, on);
	}

	void setCarrying(boolean on) {
		this.entityData.set(CARRY, on);
	}

	void syncLoad() {
		this.entityData.set(LOAD, Math.min(1F, load.total() / (float) load.capacity));
		this.entityData.set(KIND, load.kind());
	}

	public Load load() {
		return load;
	}

	/** World position of the tool tip (bucket teeth, hook, forks ...). */
	public Vec3 tip() {
		if (spec.tool.tip == null) return this.position();
		return Kinematics.world(spec, spec.tool.tip, channels(), this.position(), this.getYRot());
	}

	/** World position of a point given in model pixels on the machine's body. */
	public Vec3 bodyPoint(double[] at) {
		return this.position().add(Kinematics.toWorld(Kinematics.toLocal(at, spec.scale), this.getYRot()));
	}

	public @Nullable Player operator() {
		return this.getControllingPassenger() instanceof Player p ? p : null;
	}

	/** Called for every control packet from the operator (and directly by tests). */
	public void applyInput(int axesPacked, int actionCounter) {
		for (int i = 0; i < 4; i++) {
			int bits = (axesPacked >> (i * 2)) & 3;
			axes[i] = bits == 1 ? 1 : bits == 2 ? -1 : 0;
		}
		if (actionCounter != lastAction) {
			lastAction = actionCounter;
			actionPending = true;
		}
		inputAge = 0;
	}

	/** For tests: hold one channel's key for the next ticks. */
	public void hold(int channel, int direction) {
		int packed = 0;
		for (int i = 0; i < 4; i++) {
			int a = i == channel ? direction : axes[i];
			packed |= (a > 0 ? 1 : a < 0 ? 2 : 0) << (i * 2);
		}
		applyInput(packed, lastAction);
	}

	/** For tests: press the action button. */
	public void pressAction() {
		applyInput(0, lastAction + 1);
	}

	// ------------------------------------------------------------ ticking

	@Override
	public void tick() {
		if (this.level().isClientSide()) {
			for (int i = 0; i < 4; i++) prevChannels[i] = channel(i);
		}
		super.tick();
		if (hurtTicks > 0) hurtTicks--;
		else if (damage > 0) damage = Math.max(0, damage - 1.0F);
		this.yBodyRot = this.yHeadRot = this.getYRot();

		if (this.level() instanceof ServerLevel level) {
			serverTick(level);
		} else {
			double dx = this.getX() - this.xo, dz = this.getZ() - this.zo;
			float moved = (float) Math.sqrt(dx * dx + dz * dz);
			Vec3 facing = Vec3.directionFromRotation(0, this.getYRot());
			float sign = dx * facing.x + dz * facing.z >= 0 ? 1 : -1;
			drivenDistance += sign * moved;
			drivenSpeed = drivenSpeed * 0.7F + moved * 0.3F;
			float turn = Mth.wrapDegrees(this.getYRot() - this.yRotO);
			steer = steer * 0.8F + Mth.clamp(turn / Math.max(1F, spec.drive.turn), -1F, 1F) * 0.2F;
		}
	}

	private boolean swept;

	private void serverTick(ServerLevel level) {
		if (!swept) {
			swept = true;
			MachineTools.sweepDisplays(level, this);
		}
		if (++inputAge > 6) {
			axes[0] = axes[1] = axes[2] = axes[3] = 0;
		}
		boolean moved = false;
		for (int i = 0; i < channelCount(); i++) {
			if (axes[i] == 0) continue;
			float before = channel(i);
			setChannel(i, before + axes[i] * spec.channels.get(i).rate);
			moved |= channel(i) != before;
		}
		if (moved && soundCooldown <= 0) {
			this.playSound(SoundEvents.PISTON_EXTEND, 0.25F, 1.6F + this.random.nextFloat() * 0.2F);
			soundCooldown = 6;
		}
		if (soundCooldown > 0) soundCooldown--;
		if (actionPending) {
			actionPending = false;
			MachineTools.action(this, level);
		}
		MachineTools.tick(this, level);
		lastPos = this.position();
	}

	// ------------------------------------------------------------ no AI, no despawn, no death drops

	@Override
	protected void registerGoals() {
	}

	@Override
	public boolean removeWhenFarAway(double distSqr) {
		return false;
	}

	@Override
	public boolean requiresCustomPersistence() {
		return true;
	}

	@Override
	public boolean causeFallDamage(double fallDistance, float damageModifier, DamageSource damageSource) {
		return false;
	}

	@Override
	protected void checkFallDamage(double ya, boolean onGround, BlockState onState, BlockPos pos) {
	}

	@Override
	public boolean canBreatheUnderwater() {
		return true;
	}

	@Override
	public boolean isAffectedByPotions() {
		return false;
	}

	@Override
	public boolean canBeLeashed() {
		return false;
	}

	@Override
	public boolean isPushable() {
		return false;
	}

	@Override
	public boolean canBeCollidedWith(@Nullable Entity other) {
		return other == null || !other.isPassengerOfSameVehicle(this);
	}

	@Override
	protected boolean shouldDropLoot(ServerLevel level) {
		return false;
	}

	@Override
	public boolean shouldRenderAtSqrDistance(double distance) {
		double d = 96 + spec.camera * 8;
		return distance < d * d;
	}

	// ------------------------------------------------------------ breaking (players only, like boats)

	@Override
	public boolean hurtServer(ServerLevel level, DamageSource source, float amount) {
		if (this.isRemoved()) return true;
		if (source.is(DamageTypes.GENERIC_KILL) || source.is(DamageTypeTags.BYPASSES_INVULNERABILITY)) {
			breakApart(level, false);
			return true;
		}
		if (!(source.getEntity() instanceof Player player)) return false;
		if (player.getAbilities().instabuild) {
			breakApart(level, false);
			return true;
		}
		this.hurtTicks = 10;
		this.damage += Math.max(1.0F, amount) * 10.0F;
		this.playSound(SoundEvents.IRON_GOLEM_HURT, 0.6F, 1.2F);
		if (this.damage > 40.0F + spec.mass) breakApart(level, true);
		return true;
	}

	/** Ejects everyone, drops the load (and the machine as an item) and removes it. */
	public void breakApart(ServerLevel level, boolean dropItem) {
		this.ejectPassengers();
		MachineTools.releaseAll(this, level);
		for (Map.Entry<String, Integer> e : load.view().entrySet()) TerrainOps.drop(level, this.position().add(0, 1, 0), e.getKey(), e.getValue());
		load.clear();
		if (dropItem) {
			this.spawnAtLocation(level, new ItemStack(ModRegistry.placer(spec.id)));
			this.playSound(SoundEvents.ITEM_BREAK.value(), 1.0F, 0.8F);
		}
		this.discard();
	}

	// ------------------------------------------------------------ riding

	@Override
	public InteractionResult interact(Player player, InteractionHand hand, Vec3 location) {
		ItemStack held = player.getItemInHand(hand);
		InteractionResult tool = MachineTools.interact(this, player, held);
		if (tool != InteractionResult.PASS) return tool;
		if (player.isSecondaryUseActive() || this.getPassengers().size() >= spec.seats.size()) return InteractionResult.PASS;
		if (!this.level().isClientSide()) player.startRiding(this);
		return InteractionResult.SUCCESS;
	}

	@Override
	protected boolean canAddPassenger(Entity passenger) {
		return this.getPassengers().size() < spec.seats.size();
	}

	@Override
	public @Nullable LivingEntity getControllingPassenger() {
		return this.getFirstPassenger() instanceof Player p ? p : null;
	}

	@Override
	protected Vec3 getPassengerAttachmentPoint(Entity passenger, EntityDimensions dimensions, float scale) {
		int i = Math.max(0, this.getPassengers().indexOf(passenger));
		MachineSpec.Seat seat = spec.seats.get(Math.min(i, spec.seats.size() - 1));
		Vec3 local;
		if (seat.bone != null) {
			// Seats on a moving part (a slewing cab) follow it round.
			local = Kinematics.toLocal(Kinematics.point(seat.chain, spec.drivers, channels(), seat.at), spec.scale).add(0, -0.15, 0);
		} else {
			local = new Vec3(seat.rest[0], seat.rest[1], seat.rest[2]);
		}
		return Kinematics.toWorld(local, this.getYRot());
	}

	@Override
	protected void positionRider(Entity passenger, Entity.MoveFunction moveFunction) {
		super.positionRider(passenger, moveFunction);
		if (passenger instanceof LivingEntity living) living.setYBodyRot(this.getYRot());
	}

	@Override
	protected void tickRidden(Player controller, Vec3 riddenInput) {
		super.tickRidden(controller, riddenInput);
		if (!this.isLocalInstanceAuthoritative() || !spec.drives()) return;
		float forward = controller.zza;
		float target = forward > 0 ? 1F : forward < 0 ? -spec.drive.reverse : 0F;
		float step = target == 0 || Math.signum(target) != Math.signum(throttle) && throttle != 0 ? spec.drive.brake : spec.drive.accel;
		throttle += Mth.clamp(target - throttle, -step, step);
		// A/D steer. Wheeled machines only turn while rolling (and the other way round when
		// reversing); tracks and skid steers can also turn on the spot.
		boolean tracks = "tracks".equals(spec.drive.type) || "skid".equals(spec.drive.type);
		boolean rolling = Math.abs(throttle) > 0.05F;
		float turn = 0;
		if (rolling) turn = -controller.xxa * spec.drive.turn * (throttle < 0 ? -1 : 1) * Math.min(1F, Math.abs(throttle) * 2 + (tracks ? 0.5F : 0F));
		else if (tracks) turn = -controller.xxa * spec.drive.turn * 0.8F;
		this.setYRot(this.getYRot() + turn);
		this.yRotO = this.getYRot();
		this.yBodyRot = this.yHeadRot = this.getYRot();
	}

	@Override
	protected Vec3 getRiddenInput(Player controller, Vec3 selfInput) {
		return spec.drives() ? new Vec3(0, 0, throttle) : Vec3.ZERO;
	}

	@Override
	protected float getRiddenSpeed(Player controller) {
		return (float) this.getAttributeValue(Attributes.MOVEMENT_SPEED);
	}

	@Override
	public Vec3 getDismountLocationForPassenger(LivingEntity passenger) {
		if (!spec.drives()) return MachineTools.towerDismount(this);
		Vec3 side = new Vec3(this.getBbWidth() * 0.5 + 0.7, 0, 0).yRot(-this.getYRot() * Mth.DEG_TO_RAD);
		Vec3 rel = passenger.position().subtract(this.position());
		Vec3 pos = this.position().add(rel.dot(side) >= 0 ? side : side.scale(-1));
		return new Vec3(pos.x, this.getY(), pos.z);
	}

	// ------------------------------------------------------------ saving

	@Override
	protected void addAdditionalSaveData(ValueOutput out) {
		super.addAdditionalSaveData(out);
		for (int i = 0; i < channelCount(); i++) out.putFloat("Channel" + i, channel(i));
		out.store("Load", Load.CODEC, Map.copyOf(load.view()));
		if (carriedBlock != null) out.store("CarriedBlock", BlockState.CODEC, carriedBlock);
		if (carriedEntity != null) out.store("CarriedEntity", UUIDUtil.CODEC, carriedEntity);
		out.putInt("ConcreteColour", concreteColour);
		out.putBoolean("Mode", mode());
	}

	@Override
	protected void readAdditionalSaveData(ValueInput in) {
		super.readAdditionalSaveData(in);
		for (int i = 0; i < channelCount(); i++) setChannel(i, in.getFloatOr("Channel" + i, spec.channels.get(i).rest));
		in.read("Load", Load.CODEC).ifPresent(load::set);
		carriedBlock = in.read("CarriedBlock", BlockState.CODEC).orElse(null);
		Optional<UUID> e = in.read("CarriedEntity", UUIDUtil.CODEC);
		carriedEntity = e.orElse(null);
		concreteColour = in.getIntOr("ConcreteColour", 7);
		setMode(in.getBooleanOr("Mode", false));
		setCarrying(carriedBlock != null || carriedEntity != null);
		syncLoad();
	}

	// ------------------------------------------------------------ GeckoLib

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		RawAnimation move = RawAnimation.begin().thenLoop("animation.machines." + spec.id + ".move");
		controllers.add(new AnimationController<>("move", 0, state -> state.setAndContinue(move)));
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return geoCache;
	}

	public void hornSound() {
		this.level().playSound(null, this.getX(), this.getY(), this.getZ(), SoundEvents.NOTE_BLOCK_DIDGERIDOO.value(), SoundSource.NEUTRAL, 1F, 0.8F);
	}
}
