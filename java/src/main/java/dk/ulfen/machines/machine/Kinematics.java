package dk.ulfen.machines.machine;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import net.minecraft.util.Mth;
import net.minecraft.world.phys.Vec3;

/**
 * Forward kinematics, the same maths as src/lib/kinematics.mjs (and GeckoLib): a bone is
 * moved by its animated position, then rotated around its pivot by Rz(-z) * Ry(y) * Rx(-x).
 */
public final class Kinematics {
	private Kinematics() {}

	private static double[] identity() {
		return new double[] {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
	}

	private static double[] mul(double[] a, double[] b) {
		double[] o = new double[16];
		for (int r = 0; r < 4; r++)
			for (int c = 0; c < 4; c++) {
				double s = 0;
				for (int k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
				o[r * 4 + c] = s;
			}
		return o;
	}

	private static double[] translate(double x, double y, double z) {
		return new double[] {1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1};
	}

	private static double[] rx(double t) {
		double c = Math.cos(t), s = Math.sin(t);
		return new double[] {1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1};
	}

	private static double[] ry(double t) {
		double c = Math.cos(t), s = Math.sin(t);
		return new double[] {c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1};
	}

	private static double[] rz(double t) {
		double c = Math.cos(t), s = Math.sin(t);
		return new double[] {c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
	}

	private static double[] rotate(double x, double y, double z) {
		return mul(rz(-z * Mth.DEG_TO_RAD), mul(ry(y * Mth.DEG_TO_RAD), rx(-x * Mth.DEG_TO_RAD)));
	}

	/** Offsets from the channel values: bone -> [rx, ry, rz, px, py, pz]. */
	public static Map<String, double[]> pose(List<MachineSpec.Driver> drivers, float[] values) {
		Map<String, double[]> out = new HashMap<>();
		for (MachineSpec.Driver d : drivers) {
			double v = d.base;
			for (List<Object> term : d.terms) {
				int ch = Integer.parseInt(((String) term.get(0)).substring(1));
				v += values[ch] * ((Number) term.get(1)).doubleValue();
			}
			double[] b = out.computeIfAbsent(d.bone, k -> new double[6]);
			b[("position".equals(d.prop) ? 3 : 0) + d.axis] += v;
		}
		return out;
	}

	/** A point on the last bone of `chain` (model pixels) in model space, for the given channel values. */
	public static double[] point(List<MachineSpec.Bone> chain, List<MachineSpec.Driver> drivers, float[] values, double[] at) {
		Map<String, double[]> posed = pose(drivers, values);
		double[] m = identity();
		for (MachineSpec.Bone bone : chain) {
			double[] p = posed.getOrDefault(bone.name, new double[6]);
			double[] rest = bone.rotation != null ? bone.rotation : new double[3];
			double[] pv = bone.pivot;
			double[] local = mul(translate(p[3], p[4], p[5]),
				mul(translate(pv[0], pv[1], pv[2]), mul(rotate(rest[0] + p[0], rest[1] + p[1], rest[2] + p[2]), translate(-pv[0], -pv[1], -pv[2]))));
			m = mul(m, local);
		}
		return new double[] {
			m[0] * at[0] + m[1] * at[1] + m[2] * at[2] + m[3],
			m[4] * at[0] + m[5] * at[1] + m[6] * at[2] + m[7],
			m[8] * at[0] + m[9] * at[1] + m[10] * at[2] + m[11],
		};
	}

	/** Model pixels -> entity-local blocks (+z forward, +x left): the model faces -z. */
	public static Vec3 toLocal(double[] p, float scale) {
		return new Vec3(p[0] / 16.0 * scale, p[1] / 16.0 * scale, -p[2] / 16.0 * scale);
	}

	/** Entity-local blocks -> world offset for an entity facing `yaw` degrees. */
	public static Vec3 toWorld(Vec3 local, float yaw) {
		return local.yRot(-yaw * Mth.DEG_TO_RAD);
	}

	/** Model point -> world position of a machine. */
	public static Vec3 world(MachineSpec spec, MachineSpec.Point p, float[] values, Vec3 origin, float yaw) {
		return origin.add(toWorld(toLocal(point(p.chain, spec.drivers, values, p.at), spec.scale), yaw));
	}
}
