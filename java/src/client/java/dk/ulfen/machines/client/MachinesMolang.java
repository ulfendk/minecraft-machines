package dk.ulfen.machines.client;

import com.geckolib.loading.math.MolangQueries;
import dk.ulfen.machines.machine.MachineEntity;
import net.minecraft.util.Mth;

/** The animation variables the generated machine animations read (see src/lib/anim.mjs). */
public final class MachinesMolang {
	private MachinesMolang() {}

	private static double channel(MachineEntity m, int i, float partialTick) {
		if (i >= m.channelCount()) return 0;
		float now = m.channel(i), before = m.prevChannels[i];
		if (m.spec.channels.get(i).wrap) return before + Mth.wrapDegrees(now - before) * partialTick;
		return Mth.lerp(partialTick, before, now);
	}

	public static void register() {
		for (int i = 0; i < 4; i++) {
			int ch = i;
			MolangQueries.<Object>setActorVariable("variable.m_c" + i, a -> a.animatable() instanceof MachineEntity m ? channel(m, ch, a.partialTick()) : 0);
		}
		MolangQueries.<Object>setActorVariable("variable.m_load", a -> a.animatable() instanceof MachineEntity m ? m.loadFraction() : 0);
		MolangQueries.<Object>setActorVariable("variable.m_kind", a -> a.animatable() instanceof MachineEntity m ? m.loadKind() : 0);
		MolangQueries.<Object>setActorVariable("variable.m_steer", a -> a.animatable() instanceof MachineEntity m ? m.steer : 0);
		MolangQueries.<Object>setActorVariable("variable.m_dist", a -> a.animatable() instanceof MachineEntity m ? m.drivenDistance : 0);
		MolangQueries.<Object>setActorVariable("variable.m_time", a -> a.animatable() instanceof MachineEntity m ? (m.tickCount + a.partialTick()) / 20.0 : 0);
		// Java shows the carried block itself (a block display), so the Bedrock crate stays hidden.
		MolangQueries.<Object>setActorVariable("variable.m_carry", a -> 0);
		MolangQueries.<Object>setActorVariable("variable.m_pour", a -> a.animatable() instanceof MachineEntity m && m.mode() ? 1 : 0);
	}
}
