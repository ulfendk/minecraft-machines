package dk.ulfen.machines.mixin;

import net.minecraft.world.entity.Display;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(Display.class)
public interface DisplayAccessor {
	/** Smooth movement between the server's position updates. */
	@Invoker("setPosRotInterpolationDuration")
	void machines$setPosRotInterpolationDuration(int ticks);
}
