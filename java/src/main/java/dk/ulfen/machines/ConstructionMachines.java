package dk.ulfen.machines;

import dk.ulfen.machines.machine.ManualItem;
import dk.ulfen.machines.net.MachineControlPayload;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;

public class ConstructionMachines implements ModInitializer {
	public static final String MOD_ID = "machines";

	@Override
	public void onInitialize() {
		ModRegistry.register();
		MachineControlPayload.register();
		// Everyone gets a Machine Manual the first time they join.
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> ManualItem.giveOnce(handler.getPlayer()));
	}
}
