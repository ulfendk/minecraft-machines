package dk.ulfen.machines.machine;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Machine data generated from the shared specs by tools/build.mjs (resource /machines/machines.json).
 * Positions are model pixels; {@link Kinematics} turns them into world positions.
 */
public final class MachineSpec {
	public String id;
	public String group;
	public float scale;
	public float width;
	public float height;
	public float health;
	public float mass;
	public float camera;
	public List<Seat> seats;
	public Drive drive;
	public List<Channel> channels;
	public List<Driver> drivers;
	public Tool tool;

	public static final class Seat {
		public String bone;
		public double[] at;
		public List<Bone> chain;
		/** entity-space position at rest (blocks, +z forward) */
		public double[] rest;
	}

	public static final class Drive {
		/** wheels, tracks, articulated or none */
		public String type;
		public float speed;
		public float accel;
		public float brake;
		public float reverse;
		public float turn;
	}

	public static final class Channel {
		public String id;
		public float min;
		public float max;
		public float rate;
		public float rest;
		public boolean wrap;
	}

	public static final class Bone {
		public String name;
		public String parent;
		public double[] pivot;
		public double[] rotation;
	}

	/** rotation/position of a bone = base + sum(factor * channel) on one axis */
	public static final class Driver {
		public String bone;
		public String prop;
		public int axis;
		public List<List<Object>> terms;
		public double base;
	}

	public static final class Point {
		public String bone;
		public double[] at;
		public List<Bone> chain;
	}

	public static final class Tool {
		/** bucket, blade, bed, hook, forks, drum, roller or none */
		public String kind;
		public Point tip;
		public float reach;
		public int capacity;
		public float maxHardness;
		/** cranes: the heaviest thing they lift */
		public float lift;
		/** index of the hoist channel (cranes) */
		public Integer rope;
		/** bulldozer blade / road roller: strip across the machine, in blocks from its centre */
		public Strip strip;
		/** dump truck: where the load pours out (model pixels) */
		public double[] pour;
		/** wheel loaders and skid steers fill the bucket by driving into a pile */
		public boolean scoop;
	}

	public static final class Strip {
		public float ahead;
		public float width;
	}

	public boolean drives() {
		return !"none".equals(drive.type);
	}

	public static List<MachineSpec> load() {
		try (var in = MachineSpec.class.getResourceAsStream("/machines/machines.json")) {
			if (in == null) throw new IllegalStateException("missing /machines/machines.json - run `npm run build` first");
			return new Gson().fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), new TypeToken<List<MachineSpec>>() {}.getType());
		} catch (java.io.IOException e) {
			throw new RuntimeException(e);
		}
	}
}
