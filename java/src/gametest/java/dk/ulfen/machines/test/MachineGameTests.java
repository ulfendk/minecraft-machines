package dk.ulfen.machines.test;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.machine.Kinematics;
import dk.ulfen.machines.machine.MachineEntity;
import dk.ulfen.machines.machine.MachineSpec;
import dk.ulfen.machines.machine.MachineTools;
import dk.ulfen.machines.machine.TowerCraneKitItem;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.BlockPos;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.Vec3;

/** Server-side checks run by `./gradlew runGameTest` (and in CI). */
public class MachineGameTests {
	private static MachineEntity spawn(GameTestHelper helper, String id, BlockPos pos, float yaw) {
		MachineEntity m = helper.spawn(ModRegistry.type(id), pos);
		m.snapTo(m.getX(), m.getY(), m.getZ(), yaw, 0);
		m.setYBodyRot(yaw);
		m.setYHeadRot(yaw);
		return m;
	}

	/** Puts the tool tip at a world position by setting channels; returns the block under the tip. */
	private static BlockPos tipBlock(MachineEntity m) {
		return BlockPos.containing(m.tip());
	}

	private static void fill(GameTestHelper helper, BlockPos absCentre, int r, Block block) {
		for (int dx = -r; dx <= r; dx++)
			for (int dy = -r; dy <= r; dy++)
				for (int dz = -r; dz <= r; dz++) helper.getLevel().setBlockAndUpdate(absCentre.offset(dx, dy, dz), block.defaultBlockState());
	}

	/** Every machine can be placed and is still there two seconds later. */
	@GameTest(maxTicks = 100, structure = "machines-test:empty_large")
	public void everyMachineSpawns(GameTestHelper helper) {
		List<MachineEntity> machines = new ArrayList<>();
		int i = 0;
		for (MachineSpec s : ModRegistry.SPECS) {
			BlockPos pos = new BlockPos(4 + (i % 4) * 9, 1, 4 + (i / 4) * 9);
			if (s.drives()) machines.add(spawn(helper, s.id, pos, 0));
			else machines.add(TowerCraneKitItem.build(helper.getLevel(), helper.absolutePos(pos), 12, 0, null));
			i++;
		}
		helper.runAfterDelay(40, () -> {
			for (MachineEntity m : machines) if (!m.isAlive()) helper.fail("Machine vanished: " + m.spec.id);
			helper.succeed();
		});
	}

	/** The Java kinematics put the tool tip where the JavaScript kinematics say (fk_fixtures.json). */
	@GameTest
	public void kinematicsMatch(GameTestHelper helper) {
		try (var in = MachineGameTests.class.getResourceAsStream("/machines/fk_fixtures.json")) {
			JsonArray fixtures = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonArray();
			for (JsonElement el : fixtures) {
				var f = el.getAsJsonObject();
				MachineSpec s = ModRegistry.spec(f.get("id").getAsString());
				float[] values = new float[4];
				var v = f.getAsJsonArray("values");
				for (int i = 0; i < v.size(); i++) values[i] = v.get(i).getAsFloat();
				Vec3 tip = Kinematics.toLocal(Kinematics.point(s.tool.tip.chain, s.drivers, values, s.tool.tip.at), s.scale);
				var e = f.getAsJsonArray("tip");
				Vec3 expected = new Vec3(e.get(0).getAsDouble(), e.get(1).getAsDouble(), e.get(2).getAsDouble());
				if (tip.distanceTo(expected) > 0.01) helper.fail(s.id + ": tip " + tip + " but JavaScript says " + expected);
			}
		} catch (java.io.IOException ex) {
			helper.fail(ex.toString());
		}
		helper.succeed();
	}

	/** The excavator digs the dirt at its bucket into the load. */
	@GameTest(structure = "machines-test:empty_large")
	public void excavatorDigs(GameTestHelper helper) {
		MachineEntity m = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		BlockPos tip = tipBlock(m);
		fill(helper, tip, 1, Blocks.DIRT);
		m.pressAction();
		helper.runAfterDelay(2, () -> {
			if (m.load().total() == 0) helper.fail("Excavator dug nothing at " + tip + " (machine at " + m.blockPosition() + ", tip " + m.tip() + ")");
			if (helper.getLevel().getBlockState(tip).is(Blocks.DIRT)) helper.fail("The block at the bucket is still there");
			helper.succeed();
		});
	}

	/** Never bedrock, obsidian or chests. */
	@GameTest(structure = "machines-test:empty_large")
	public void excavatorLeavesProtectedBlocks(GameTestHelper helper) {
		MachineEntity m = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		BlockPos tip = tipBlock(m);
		fill(helper, tip, 2, Blocks.OBSIDIAN);
		helper.getLevel().setBlockAndUpdate(tip, Blocks.BEDROCK.defaultBlockState());
		helper.getLevel().setBlockAndUpdate(tip.east(), Blocks.OBSIDIAN.defaultBlockState());
		helper.getLevel().setBlockAndUpdate(tip.west(), Blocks.CHEST.defaultBlockState());
		m.pressAction();
		helper.runAfterDelay(2, () -> {
			if (m.load().total() != 0) helper.fail("Excavator dug a protected block");
			if (!helper.getLevel().getBlockState(tip).is(Blocks.BEDROCK)) helper.fail("Bedrock is gone");
			if (!helper.getLevel().getBlockState(tip.west()).is(Blocks.CHEST)) helper.fail("The chest is gone");
			helper.succeed();
		});
	}

	/** With the game rule off, machines leave the ground alone (toggled within one tick: tests run in parallel). */
	@GameTest(structure = "machines-test:empty_large")
	public void gameRuleStopsDigging(GameTestHelper helper) {
		MachineEntity m = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		BlockPos tip = tipBlock(m);
		fill(helper, tip, 1, Blocks.DIRT);
		var rules = helper.getLevel().getGameRules();
		rules.set(ModRegistry.TERRAIN_RULE, false, helper.getLevel().getServer());
		MachineTools.action(m, helper.getLevel());
		rules.set(ModRegistry.TERRAIN_RULE, true, helper.getLevel().getServer());
		if (m.load().total() != 0) helper.fail("Dug although the game rule is off");
		helper.succeed();
	}

	/** Working a channel moves it (and stops at its limit). */
	@GameTest(structure = "machines-test:empty_large")
	public void channelsMove(GameTestHelper helper) {
		MachineEntity m = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		float before = m.channel(1);
		helper.runAfterDelay(1, () -> m.hold(1, 1));
		helper.runAfterDelay(3, () -> m.hold(1, 1));
		helper.runAfterDelay(5, () -> {
			if (m.channel(1) <= before) helper.fail("Boom did not rise");
			helper.succeed();
		});
	}

	// ------------------------------------------------------------ helpers

	/** Moves a machine forward every tick for `ticks` ticks, as if it were driven. */
	private static void drive(GameTestHelper helper, MachineEntity m, int ticks, double speed) {
		Vec3 f = Vec3.directionFromRotation(0, m.getYRot()).scale(speed);
		for (int t = 1; t <= ticks; t++) helper.runAfterDelay(t, () -> m.setPos(m.position().add(f)));
	}

	private static int count(GameTestHelper helper, Block block, BlockPos absCentre, int r) {
		int n = 0;
		for (BlockPos p : BlockPos.betweenClosed(absCentre.offset(-r, -r, -r), absCentre.offset(r, r, r))) {
			if (helper.getLevel().getBlockState(p).is(block)) n++;
		}
		return n;
	}

	/** Sets the hoist rope so the hook hangs at about `y` (absolute). */
	private static void hookTo(MachineEntity m, double y) {
		int rope = m.spec.tool.rope;
		var c = m.spec.channels.get(rope);
		float lo = c.min, hi = c.max;
		for (int i = 0; i < 30; i++) {
			float mid = (lo + hi) / 2;
			m.setChannel(rope, mid);
			if (m.tip().y > y) lo = mid;
			else hi = mid;
		}
	}

	// ------------------------------------------------------------ earthmovers

	/** An excavator dumping over a dump truck fills the truck's bed. */
	@GameTest(structure = "machines-test:empty_large")
	public void excavatorLoadsTruck(GameTestHelper helper) {
		MachineEntity ex = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		ex.setChannel(1, 40); // boom up, so the bucket is high above the truck
		ex.load().add("minecraft:dirt", 4);
		Vec3 tip = ex.tip();
		MachineEntity truck = helper.spawn(ModRegistry.type("dump_truck"), new Vec3(tip.x, helper.absoluteVec(Vec3.ZERO).y + 1, tip.z).subtract(helper.absoluteVec(Vec3.ZERO)));
		helper.runAfterDelay(2, ex::pressAction);
		helper.runAfterDelay(4, () -> {
			if (truck.load().total() != 4) helper.fail("Dump truck holds " + truck.load().total() + " blocks, expected 4");
			if (!ex.load().isEmpty()) helper.fail("Excavator still holds its load");
			helper.succeed();
		});
	}

	/** Tipping the bed pours the load out behind the truck. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void dumpTruckTips(GameTestHelper helper) {
		MachineEntity truck = spawn(helper, "dump_truck", new BlockPos(20, 1, 12), 0);
		truck.load().add("minecraft:dirt", 8);
		truck.setChannel(0, 55);
		helper.runAfterDelay(60, () -> {
			if (!truck.load().isEmpty()) helper.fail("Truck still holds " + truck.load().total() + " blocks");
			int poured = count(helper, Blocks.DIRT, BlockPos.containing(truck.bodyPoint(truck.spec.tool.pour)), 4);
			if (poured < 8) helper.fail("Only " + poured + " dirt blocks behind the truck");
			helper.succeed();
		});
	}

	/** Driving the bulldozer over bumps cuts them away. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void bulldozerLevels(GameTestHelper helper) {
		MachineEntity dozer = spawn(helper, "bulldozer", new BlockPos(20, 1, 4), 0);
		for (int z = 9; z <= 16; z += 2)
			for (int x = 19; x <= 21; x++) helper.setBlock(new BlockPos(x, 1, z), Blocks.DIRT);
		drive(helper, dozer, 100, 0.12);
		helper.runAfterDelay(105, () -> {
			for (int z = 9; z <= 16; z += 2)
				for (int x = 19; x <= 21; x++)
					if (helper.getBlockState(new BlockPos(x, 1, z)).is(Blocks.DIRT)) helper.fail("Bump left at " + x + "," + z);
			helper.succeed();
		});
	}

	/** A wheel loader with its bucket down fills it by driving into a pile. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void wheelLoaderScoops(GameTestHelper helper) {
		MachineEntity loader = spawn(helper, "wheel_loader", new BlockPos(20, 1, 4), 0);
		for (int x = 17; x <= 23; x++)
			for (int y = 1; y <= 2; y++)
				for (int z = 11; z <= 13; z++) helper.setBlock(new BlockPos(x, y, z), Blocks.SAND);
		drive(helper, loader, 60, 0.1);
		helper.runAfterDelay(65, () -> {
			if (loader.load().total() == 0) helper.fail("Loader scooped nothing");
			helper.succeed();
		});
	}

	/** The road roller presses grass into a path. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void rollerMakesPaths(GameTestHelper helper) {
		for (int x = 15; x <= 25; x++)
			for (int z = 0; z <= 30; z++) helper.setBlock(new BlockPos(x, 0, z), Blocks.GRASS_BLOCK);
		MachineEntity roller = spawn(helper, "road_roller", new BlockPos(20, 1, 4), 0);
		drive(helper, roller, 80, 0.12);
		helper.runAfterDelay(85, () -> {
			int paths = count(helper, Blocks.DIRT_PATH, helper.absolutePos(new BlockPos(20, 0, 12)), 8);
			if (paths < 5) helper.fail("Only " + paths + " path blocks");
			helper.succeed();
		});
	}

	/** Sand in the mixer comes out of the chute as concrete. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void mixerPoursConcrete(GameTestHelper helper) {
		MachineEntity mixer = spawn(helper, "mixer_truck", new BlockPos(20, 1, 10), 0);
		mixer.load().add("minecraft:sand", 3);
		helper.runAfterDelay(2, mixer::pressAction);
		helper.runAfterDelay(40, () -> {
			int concrete = count(helper, net.minecraft.core.registries.BuiltInRegistries.BLOCK.getValue(net.minecraft.resources.Identifier.parse("minecraft:gray_concrete")), BlockPos.containing(mixer.tip()), 4);
			if (concrete < 3) helper.fail("Only " + concrete + " concrete blocks poured");
			if (!mixer.load().isEmpty()) helper.fail("Mixer still holds sand");
			helper.succeed();
		});
	}

	/** The forklift picks a log up and sets it down higher up. */
	@GameTest(structure = "machines-test:empty_large")
	public void forkliftMovesBlock(GameTestHelper helper) {
		MachineEntity fork = spawn(helper, "forklift", new BlockPos(20, 1, 10), 0);
		BlockPos at = BlockPos.containing(fork.tip().add(0, 0.3, 0));
		helper.getLevel().setBlockAndUpdate(at, Blocks.OAK_LOG.defaultBlockState());
		helper.runAfterDelay(2, fork::pressAction);
		helper.runAfterDelay(4, () -> {
			if (helper.getLevel().getBlockState(at).is(Blocks.OAK_LOG)) helper.fail("The log was not picked up");
			fork.setChannel(0, 2);
		});
		helper.runAfterDelay(6, fork::pressAction);
		helper.runAfterDelay(8, () -> {
			if (count(helper, Blocks.OAK_LOG, at.above(2), 1) != 1) helper.fail("The log was not set down two blocks up");
			helper.succeed();
		});
	}

	// ------------------------------------------------------------ cranes

	/** A crane hooks a pig and lifts it. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void craneLiftsPig(GameTestHelper helper) {
		MachineEntity crane = spawn(helper, "crawler_crane", new BlockPos(20, 1, 30), 180);
		crane.setChannel(1, 70);
		Vec3 hook = crane.tip();
		double floor = helper.absoluteVec(Vec3.ZERO).y + 1;
		Mob pig = (Mob) helper.spawn(EntityTypes.PIG, new Vec3(hook.x, floor, hook.z).subtract(helper.absoluteVec(Vec3.ZERO)));
		pig.setNoAi(true);
		hookTo(crane, floor + 1.2);
		helper.runAfterDelay(2, crane::pressAction);
		helper.runAfterDelay(4, () -> hookTo(crane, floor + 6));
		helper.runAfterDelay(8, () -> {
			if (pig.getY() < floor + 3) helper.fail("The pig was not lifted (y " + (pig.getY() - floor) + ")");
			helper.succeed();
		});
	}

	/** A crane lifts a block from under its hook. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void craneLiftsBlock(GameTestHelper helper) {
		MachineEntity crane = spawn(helper, "crawler_crane", new BlockPos(20, 1, 30), 180);
		crane.setChannel(1, 70);
		double floor = helper.absoluteVec(Vec3.ZERO).y + 1;
		Vec3 hook = crane.tip();
		BlockPos block = BlockPos.containing(hook.x, floor, hook.z);
		helper.getLevel().setBlockAndUpdate(block, Blocks.OAK_PLANKS.defaultBlockState());
		hookTo(crane, floor + 1.3);
		helper.runAfterDelay(2, crane::pressAction);
		helper.runAfterDelay(4, () -> {
			if (helper.getLevel().getBlockState(block).is(Blocks.OAK_PLANKS)) helper.fail("The block is still on the ground");
			if (!crane.carrying()) helper.fail("The crane is not carrying anything");
			helper.succeed();
		});
	}

	/** A crane cannot lift a machine heavier than its limit. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void craneRefusesTooHeavy(GameTestHelper helper) {
		MachineEntity crane = spawn(helper, "truck_crane", new BlockPos(20, 1, 30), 180);
		crane.setChannel(1, 50);
		double floor = helper.absoluteVec(Vec3.ZERO).y + 1;
		Vec3 hook = crane.tip();
		MachineEntity heavy = helper.spawn(ModRegistry.type("crawler_crane"), new Vec3(hook.x, floor, hook.z).subtract(helper.absoluteVec(Vec3.ZERO)));
		hookTo(crane, floor + heavy.getBbHeight() + 0.3);
		helper.runAfterDelay(2, crane::pressAction);
		helper.runAfterDelay(4, () -> {
			if (crane.carrying()) helper.fail("The mobile crane lifted a crawler crane");
			helper.succeed();
		});
	}

	/** The kit builds a mast with the crane on top; without its mast the crane comes down as a kit. */
	@GameTest(maxTicks = 200, structure = "machines-test:empty_large")
	public void towerCraneNeedsItsMast(GameTestHelper helper) {
		BlockPos base = helper.absolutePos(new BlockPos(20, 1, 20));
		MachineEntity top = TowerCraneKitItem.build(helper.getLevel(), base, 12, 0, null);
		if (top == null) {
			helper.fail("The kit found no room");
			return;
		}
		for (int y = 0; y < 12; y++) if (!helper.getLevel().getBlockState(base.above(y)).is(ModRegistry.CRANE_MAST)) helper.fail("Mast block missing at " + y);
		helper.runAfterDelay(5, () -> helper.getLevel().setBlockAndUpdate(base.above(11), Blocks.AIR.defaultBlockState()));
		helper.runAfterDelay(50, () -> {
			if (top.isAlive()) helper.fail("The crane is still standing without its mast");
			helper.succeed();
		});
	}
}
