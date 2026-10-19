package dk.ulfen.machines.test;

import java.util.List;

import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.client.MachineKeys;
import dk.ulfen.machines.machine.MachineEntity;
import dk.ulfen.machines.machine.MachineSpec;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestServerContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.CameraType;
import net.minecraft.core.BlockPos;
import net.minecraft.util.Mth;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.AABB;

/**
 * Starts a real client: screenshots every machine (images land in build/run/clientGameTest/screenshots),
 * marks where the game thinks the tool tip is with a gold block (it should sit on the bucket teeth, the
 * hook or the forks), then drives each machine with simulated keys and works its first channel with the
 * operating keys, which checks the whole key -> packet -> server path.
 * `-Pmachines.screenshot=excavator,dump_truck` limits it to those machines.
 */
public class MachineClientGameTest implements FabricClientGameTest {
	@Override
	public void runTest(ClientGameTestContext context) {
		try (TestSingleplayerContext world = context.worldBuilder().create()) {
			TestServerContext server = world.getServer();
			server.runCommand("time set noon");
			server.runCommand("weather clear");
			server.runCommand("gamerule advance_time false");
			server.runCommand("gamerule spawn_mobs false");
			server.runCommand("gamemode creative @a");
			context.waitTicks(40);

			if (System.getProperty("machines.calibrate") != null) {
				calibrate(context, server);
				return;
			}
			String filter = System.getProperty("machines.screenshot");
			List<String> only = filter == null ? List.of() : List.of(filter.split(","));
			BlockPos[] marker = new BlockPos[1];
			for (MachineSpec spec : ModRegistry.SPECS) {
				if (!only.isEmpty() && !only.contains(spec.id)) continue;
				String type = "machines:" + spec.id;
				server.runCommand("ride @p dismount");
				server.runCommand("kill @e[type=!player]");
				// (fill is limited to 32768 blocks per command)
				server.runCommand("fill -40 -61 -40 40 -61 40 minecraft:grass_block");
				for (int y = -60; y < -20; y += 4) server.runCommand("fill -40 " + y + " -40 40 " + (y + 3) + " 40 minecraft:air");
				int baseY = -60;
				if (!spec.drives()) {
					server.runCommand("fill 0 -60 0 0 -49 0 machines:crane_mast");
					baseY = -48;
				}
				server.runCommand("tp @a 0 -60 8");
				server.runCommand("summon " + type + " 0.5 " + baseY + " 0.5 {Rotation:[0f,0f]}");
				context.waitTicks(5);

				// Pose the machine half-way through its channels and mark the tool tip.
				server.runOnServer(s -> {
					MachineEntity m = machine(s.overworld(), type);
					for (int i = 0; i < m.channelCount(); i++) {
						var c = spec.channels.get(i);
						m.setChannel(i, c.wrap ? 60 : c.rest + (c.max - c.rest) * 0.5F);
					}
					marker[0] = BlockPos.containing(m.tip());
					s.overworld().setBlockAndUpdate(marker[0], Blocks.GOLD_BLOCK.defaultBlockState());
				});
				context.waitTicks(10);
				int up = spec.drives() ? 4 : 2;
				look(context, server, 9, baseY + up, -9, 45, 15);
				context.takeScreenshot("machine_" + spec.id + "_tip");
				look(context, server, -10, baseY + up + 1, 10, -135, 15);
				context.takeScreenshot("machine_" + spec.id + "_back");
				server.runOnServer(s -> s.overworld().setBlockAndUpdate(marker[0], marker[0].getY() <= -61 ? Blocks.GRASS_BLOCK.defaultBlockState() : Blocks.AIR.defaultBlockState()));

				// Ride it: the HUD shows the controls.
				server.runCommand("ride @p mount @e[type=" + type + ",limit=1]");
				context.waitTicks(10);
				context.runOnClient(mc -> mc.options.setCameraType(CameraType.THIRD_PERSON_BACK));
				server.runCommand("rotate @p 30 20");
				context.waitTicks(15);
				context.takeScreenshot("machine_" + spec.id + "_ride");
				context.runOnClient(mc -> mc.options.setCameraType(CameraType.FIRST_PERSON));

				if (spec.drives()) {
					double[] start = state(server, type);
					context.getInput().holdKey(o -> o.keyUp);
					context.waitTicks(50);
					context.getInput().releaseKey(o -> o.keyUp);
					context.waitTicks(15);
					double[] moved = state(server, type);
					double dist = Math.hypot(moved[0] - start[0], moved[2] - start[2]);
					context.getInput().holdKey(o -> o.keyUp);
					context.getInput().holdKey(o -> o.keyLeft);
					context.waitTicks(30);
					context.getInput().releaseKey(o -> o.keyLeft);
					context.getInput().releaseKey(o -> o.keyUp);
					context.waitTicks(15);
					double[] turned = state(server, type);
					double yaw = Math.abs(Mth.wrapDegrees(turned[3] - moved[3]));
					System.out.printf("[machines-test] %s drove %.1f blocks (from %.1f %.1f %.1f to %.1f %.1f %.1f), turned %.0f degrees%n", spec.id, dist, start[0], start[1], start[2], moved[0], moved[1], moved[2], yaw);
					if (dist < 2.5) throw new AssertionError(spec.id + " did not drive forward (" + dist + " blocks)");
					if (yaw < 15) throw new AssertionError(spec.id + " did not steer (" + yaw + " degrees)");
				}
				if (spec.channels.size() > 0) {
					float before = channel(server, type, 0);
					var c = spec.channels.get(0);
					boolean raise = c.wrap || before < c.max - 1;
					context.getInput().holdKey(raise ? MachineKeys.POS[0] : MachineKeys.NEG[0]);
					context.waitTicks(20);
					context.getInput().releaseKey(raise ? MachineKeys.POS[0] : MachineKeys.NEG[0]);
					context.waitTicks(5);
					float after = channel(server, type, 0);
					System.out.printf("[machines-test] %s %s: %.1f -> %.1f%n", spec.id, c.id, before, after);
					if (Math.abs(Mth.wrapDegrees(after - before)) < Math.min(3, (c.max - c.min) * 0.2)) throw new AssertionError(spec.id + ": the operating key did not move " + c.id);
				}
			}
		}
	}

	/**
	 * Top-down view of an excavator at rest (slew 0) and slewed +90, with markers: gold = computed tool tip,
	 * diamond = entity-local 3 blocks forward, emerald = entity-local 3 blocks to +x. Used to check that
	 * the kinematics match what GeckoLib draws.
	 */
	private static void calibrate(ClientGameTestContext context, TestServerContext server) {
		server.runCommand("fill -20 -61 -20 20 -61 20 minecraft:white_concrete");
		server.runCommand("summon machines:excavator 0.5 -60 0.5 {Rotation:[0f,0f],NoAI:1b}");
		context.waitTicks(5);
		for (float slew : new float[] {0, 90}) {
			server.runOnServer(s -> {
				var level = s.overworld();
				MachineEntity m = machine(level, "machines:excavator");
				m.setChannel(0, slew);
				m.setChannel(1, 0);
				m.setChannel(2, -45);
				m.setChannel(3, 0);
				level.setBlockAndUpdate(BlockPos.containing(m.tip()).atY(-61), Blocks.GOLD_BLOCK.defaultBlockState());
				level.setBlockAndUpdate(BlockPos.containing(m.position().add(dk.ulfen.machines.machine.Kinematics.toWorld(new net.minecraft.world.phys.Vec3(0, 0, 3), m.getYRot()))).atY(-61), Blocks.DIAMOND_BLOCK.defaultBlockState());
				level.setBlockAndUpdate(BlockPos.containing(m.position().add(dk.ulfen.machines.machine.Kinematics.toWorld(new net.minecraft.world.phys.Vec3(3, 0, 0), m.getYRot()))).atY(-61), Blocks.EMERALD_BLOCK.defaultBlockState());
			});
			server.runCommand("tp @p 0.5 -40 0.5 0 90");
			context.waitTicks(20);
			context.takeScreenshot("calibrate_slew_" + (int) slew);
			server.runCommand("fill -20 -61 -20 20 -61 20 minecraft:white_concrete");
		}
	}

	/** Puts the camera somewhere and makes sure the client has taken the new view. */
	private static void look(ClientGameTestContext context, TestServerContext server, double x, double y, double z, float yaw, float pitch) {
		server.runCommand("tp @p " + x + " " + y + " " + z + " " + yaw + " " + pitch);
		context.waitTicks(5);
		context.runOnClient(mc -> {
			mc.player.setPos(x, y, z);
			mc.player.setYRot(yaw);
			mc.player.setXRot(pitch);
		});
		context.waitTicks(10);
	}

	private static MachineEntity machine(net.minecraft.server.level.ServerLevel level, String type) {
		return level.getEntitiesOfClass(MachineEntity.class, new AABB(-200, -100, -200, 200, 100, 200),
			e -> ("machines:" + e.spec.id).equals(type)).getFirst();
	}

	private static double[] state(TestServerContext server, String type) {
		return server.computeOnServer(s -> {
			MachineEntity e = machine(s.overworld(), type);
			return new double[] {e.getX(), e.getY(), e.getZ(), e.getYRot()};
		});
	}

	private static float channel(TestServerContext server, String type, int i) {
		return server.computeOnServer(s -> machine(s.overworld(), type).channel(i));
	}
}
