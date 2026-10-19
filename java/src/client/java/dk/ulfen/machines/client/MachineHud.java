package dk.ulfen.machines.client;

import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.machine.MachineEntity;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.network.chat.Component;

/** A small panel in the corner that shows the operating keys of the machine you drive. */
public final class MachineHud {
	public static boolean visible = true;

	private MachineHud() {}

	public static void register() {
		HudElementRegistry.attachElementAfter(VanillaHudElements.HOTBAR, ModRegistry.id("controls"), (g, delta) -> draw(g));
		// Machines are not animals: no hearts for them above the hotbar.
		HudElementRegistry.replaceElement(VanillaHudElements.MOUNT_HEALTH, vanilla -> (g, delta) -> {
			if (!(Minecraft.getInstance().player != null && Minecraft.getInstance().player.getVehicle() instanceof MachineEntity)) vanilla.extractRenderState(g, delta);
		});
	}

	private static void draw(GuiGraphicsExtractor g) {
		Minecraft mc = Minecraft.getInstance();
		MachineEntity m = MachineKeys.driving(mc);
		if (m == null || mc.gui.hud.isHidden()) return;
		Font font = mc.font;
		int x = 6, y = 6, line = 11;
		int rows = (visible ? m.channelCount() + 2 : 0) + 1 + (m.spec.tool.capacity > 0 ? 1 : 0);
		Component[] keys = new Component[m.channelCount()];
		int keyWidth = font.width(Component.translatable("machines.hud.load"));
		int labelWidth = font.width(Component.translatable("machines.hud.drive")) - 0;
		for (int i = 0; i < keys.length; i++) {
			keys[i] = Component.empty().append(MachineKeys.NEG[i].getTranslatedKeyMessage()).append(" / ").append(MachineKeys.POS[i].getTranslatedKeyMessage());
			keyWidth = Math.max(keyWidth, font.width(keys[i]));
			labelWidth = Math.max(labelWidth, font.width(Component.translatable("machines.channel." + m.spec.id + "." + i)));
		}
		int col = keyWidth + 8;
		g.fill(x - 3, y - 3, x + Math.max(col + labelWidth, 150) + 4, y + rows * line + 1, 0x88000000);
		g.text(font, Component.translatable("entity.machines." + m.spec.id), x, y, 0xFFF2B705, true);
		y += line;
		if (visible) {
			g.text(font, Component.translatable("machines.hud.drive"), x, y, 0xFFCCCCCC, true);
			y += line;
			for (int i = 0; i < m.channelCount(); i++) {
				g.text(font, keys[i], x, y, 0xFFFFFFFF, true);
				g.text(font, Component.translatable("machines.channel." + m.spec.id + "." + i), x + col, y, 0xFFDDDDDD, true);
				y += line;
			}
			Component action = Component.empty().append(MachineKeys.ACTION.getTranslatedKeyMessage()).append(": ")
				.append(Component.translatable("machines.action." + m.spec.id));
			if (m.mode()) action = action.copy().append(" ✔");
			g.text(font, action, x, y, 0xFFFFFFFF, true);
			y += line;
		}
		if (m.spec.tool.capacity > 0) {
			int w = 100;
			g.text(font, Component.translatable("machines.hud.load"), x, y, 0xFFDDDDDD, true);
			g.fill(x + col, y + 1, x + col + w, y + 8, 0xFF333333);
			g.fill(x + col, y + 1, x + col + Math.round(w * m.loadFraction()), y + 8, 0xFFF2B705);
		}
	}
}
