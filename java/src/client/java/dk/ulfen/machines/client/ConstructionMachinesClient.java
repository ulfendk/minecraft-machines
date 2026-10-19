package dk.ulfen.machines.client;

import dk.ulfen.machines.ModRegistry;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.renderer.entity.EntityRenderers;

public class ConstructionMachinesClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		MachinesMolang.register();
		for (var spec : ModRegistry.SPECS) EntityRenderers.register(ModRegistry.type(spec.id), ctx -> new MachineRenderer<>(ctx, spec));
		MachineKeys.register();
		MachineHud.register();
	}
}
