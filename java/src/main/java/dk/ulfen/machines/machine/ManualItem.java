package dk.ulfen.machines.machine;

import java.util.ArrayList;
import java.util.List;

import dk.ulfen.machines.ModRegistry;
import net.minecraft.ChatFormatting;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.Filterable;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.WrittenBookContent;
import net.minecraft.world.level.Level;

/** The Machine Manual: a book with a page per machine, in the reader's language. */
public class ManualItem extends Item {
	private static final String GIVEN = "machines.manual_given";

	public ManualItem(Item.Properties props) {
		super(props.component(DataComponents.WRITTEN_BOOK_CONTENT, content()));
	}

	private static WrittenBookContent content() {
		List<Filterable<Component>> pages = new ArrayList<>();
		pages.add(Filterable.passThrough(Component.empty()
			.append(Component.translatable("machines.manual.title").withStyle(ChatFormatting.BOLD))
			.append("\n\n").append(Component.translatable("machines.manual.intro"))
			.append("\n\n").append(Component.translatable("machines.tutorial.java"))));
		for (MachineSpec s : ModRegistry.SPECS) {
			var page = Component.empty()
				.append(Component.translatable("entity.machines." + s.id).withStyle(ChatFormatting.BOLD))
				.append("\n\n").append(Component.translatable("machines.info." + s.id)).append("\n");
			for (int i = 0; i < s.channels.size(); i++) {
				page.append("\n- ").append(Component.translatable("machines.channel." + s.id + "." + i));
			}
			page.append("\n- G: ").append(Component.translatable("machines.action." + s.id));
			if (s.tool.lift > 0) page.append("\n\n").append(Component.translatable("machines.manual.lift", (int) s.tool.lift));
			else if (s.tool.capacity > 0) page.append("\n\n").append(Component.translatable("machines.manual.capacity", s.tool.capacity));
			pages.add(Filterable.passThrough(page));
		}
		return new WrittenBookContent(Filterable.passThrough("Machine Manual"), "Construction Machines", 0, pages, true);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (player instanceof ServerPlayer sp) sp.openItemGui(player.getItemInHand(hand), hand);
		return InteractionResult.SUCCESS;
	}

	/** Gives a player the manual the first time they join a world with the mod. */
	public static void giveOnce(ServerPlayer player) {
		if (player.entityTags().contains(GIVEN)) return;
		player.addTag(GIVEN);
		player.getInventory().add(new ItemStack(ModRegistry.MANUAL));
		player.sendSystemMessage(Component.translatable("machines.manual.welcome"));
	}
}
