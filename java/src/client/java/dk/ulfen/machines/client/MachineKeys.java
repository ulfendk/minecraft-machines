package dk.ulfen.machines.client;

import com.mojang.blaze3d.platform.InputConstants;
import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.machine.MachineEntity;
import dk.ulfen.machines.net.MachineControlPayload;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

/**
 * Operating keys: arrows for the first two channels, I/K and U/J for the next two,
 * G for the action and H to show or hide the control panel. All can be rebound.
 */
public final class MachineKeys {
	public static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(ModRegistry.id("machines"));
	public static final KeyMapping[] NEG = new KeyMapping[4];
	public static final KeyMapping[] POS = new KeyMapping[4];
	public static KeyMapping ACTION;
	public static KeyMapping HUD;

	private static final int[][] DEFAULTS = {
		{InputConstants.KEY_LEFT, InputConstants.KEY_RIGHT}, {InputConstants.KEY_DOWN, InputConstants.KEY_UP},
		{InputConstants.KEY_K, InputConstants.KEY_I}, {InputConstants.KEY_J, InputConstants.KEY_U},
	};

	private static int actions;
	private static int lastSentAxes = -1;
	private static int quietTicks;
	private static MachineEntity tutorialFor;

	private MachineKeys() {}

	private static KeyMapping key(String name, int code) {
		return KeyMappingHelper.registerKeyMapping(new KeyMapping("key.machines." + name, code, CATEGORY));
	}

	public static void register() {
		for (int i = 0; i < 4; i++) {
			NEG[i] = key("c" + i + "_neg", DEFAULTS[i][0]);
			POS[i] = key("c" + i + "_pos", DEFAULTS[i][1]);
		}
		ACTION = key("action", InputConstants.KEY_G);
		HUD = key("hud", InputConstants.KEY_H);
		ClientTickEvents.END_CLIENT_TICK.register(MachineKeys::tick);
	}

	/** The machine the local player drives, if any. */
	public static MachineEntity driving(Minecraft mc) {
		if (mc.player != null && mc.player.getVehicle() instanceof MachineEntity m && m.getControllingPassenger() == mc.player) return m;
		return null;
	}

	private static void tick(Minecraft mc) {
		while (HUD.consumeClick()) MachineHud.visible = !MachineHud.visible;
		MachineEntity m = driving(mc);
		if (m == null) {
			while (ACTION.consumeClick()) {}
			lastSentAxes = -1;
			return;
		}
		if (tutorialFor != m && !m.tutorialShown) {
			m.tutorialShown = true;
			tutorialFor = m;
			mc.player.sendSystemMessage(Component.translatable("machines.tutorial.java"));
		}
		int axes = 0;
		for (int i = 0; i < m.channelCount(); i++) {
			int dir = (POS[i].isDown() ? 1 : 0) - (NEG[i].isDown() ? 1 : 0);
			axes |= (dir > 0 ? 1 : dir < 0 ? 2 : 0) << (i * 2);
		}
		boolean pressed = false;
		while (ACTION.consumeClick()) pressed = true;
		if (pressed) actions++;
		// Send while keys are held (the server stops a channel when packets stop coming).
		if (axes != 0 || axes != lastSentAxes || pressed || ++quietTicks > 20) {
			quietTicks = 0;
			lastSentAxes = axes;
			ClientPlayNetworking.send(new MachineControlPayload(m.getId(), axes, actions));
		}
	}
}
