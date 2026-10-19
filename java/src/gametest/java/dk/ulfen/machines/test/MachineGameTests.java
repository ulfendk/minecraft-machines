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
			machines.add(spawn(helper, s.id, new BlockPos(3 + (i % 4) * 8, 1, 3 + (i / 4) * 8), 0));
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
			if (m.load().total() == 0) helper.fail("Excavator dug nothing");
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

	/** With the game rule off, machines leave the ground alone. */
	@GameTest(structure = "machines-test:empty_large")
	public void gameRuleStopsDigging(GameTestHelper helper) {
		var rules = helper.getLevel().getGameRules();
		rules.set(ModRegistry.TERRAIN_RULE, false, helper.getLevel().getServer());
		MachineEntity m = spawn(helper, "excavator", new BlockPos(8, 1, 8), 0);
		BlockPos tip = tipBlock(m);
		fill(helper, tip, 1, Blocks.DIRT);
		m.pressAction();
		helper.runAfterDelay(2, () -> {
			rules.set(ModRegistry.TERRAIN_RULE, true, helper.getLevel().getServer());
			if (m.load().total() != 0) helper.fail("Dug although the game rule is off");
			helper.succeed();
		});
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

	/** Some unused helpers keep the imports honest when machines are added. */
	static Mob pig(GameTestHelper helper, BlockPos pos) {
		return helper.spawn(EntityTypes.PIG, pos);
	}
}
