package dk.ulfen.machines;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import dk.ulfen.machines.machine.MachineEntity;
import dk.ulfen.machines.machine.MachineItem;
import dk.ulfen.machines.machine.MachineSpec;
import dk.ulfen.machines.machine.ManualItem;
import dk.ulfen.machines.machine.MastBlock;
import dk.ulfen.machines.machine.TowerCraneKitItem;
import net.fabricmc.fabric.api.creativetab.v1.FabricCreativeModeTab;
import net.fabricmc.fabric.api.gamerule.v1.GameRuleBuilder;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.gamerules.GameRule;
import net.minecraft.world.level.gamerules.GameRuleCategory;
import net.minecraft.world.level.material.MapColor;

/** Everything the mod adds to the game registries. */
public final class ModRegistry {
	public static List<MachineSpec> SPECS = List.of();
	public static final Map<String, EntityType<MachineEntity>> TYPES = new LinkedHashMap<>();
	private static final Map<EntityType<?>, MachineSpec> BY_TYPE = new HashMap<>();
	private static final Map<String, Item> PLACERS = new LinkedHashMap<>();

	public static Block CRANE_MAST;
	public static Item MANUAL;
	public static GameRule<Boolean> TERRAIN_RULE;

	private ModRegistry() {}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(ConstructionMachines.MOD_ID, path);
	}

	public static MachineSpec spec(EntityType<?> type) {
		MachineSpec s = BY_TYPE.get(type);
		if (s == null) throw new IllegalStateException("no machine spec for " + type);
		return s;
	}

	public static MachineSpec spec(String id) {
		return BY_TYPE.get(TYPES.get(id));
	}

	public static EntityType<MachineEntity> type(String id) {
		return TYPES.get(id);
	}

	/** The item that places (or, for the tower crane, builds) a machine. */
	public static Item placer(String id) {
		return PLACERS.get(id);
	}

	static void register() {
		SPECS = MachineSpec.load();
		TERRAIN_RULE = GameRuleBuilder.forBoolean(true).category(GameRuleCategory.MISC).buildAndRegister(id("machine_terrain_editing"));

		ResourceKey<Block> mastKey = ResourceKey.create(Registries.BLOCK, id("crane_mast"));
		CRANE_MAST = Registry.register(BuiltInRegistries.BLOCK, mastKey, new MastBlock(BlockBehaviour.Properties.of()
			.setId(mastKey).mapColor(MapColor.COLOR_YELLOW).strength(3.0F, 6.0F).requiresCorrectToolForDrops()
			.sound(SoundType.METAL).noOcclusion()));
		item("crane_mast", p -> new BlockItem(CRANE_MAST, p), new Item.Properties().useBlockDescriptionPrefix());

		for (MachineSpec s : SPECS) {
			ResourceKey<EntityType<?>> key = ResourceKey.create(Registries.ENTITY_TYPE, id(s.id));
			EntityType<MachineEntity> type = EntityType.Builder.<MachineEntity>of(MachineEntity::new, MobCategory.MISC)
				.sized(s.width, s.height)
				.fireImmune()
				.clientTrackingRange("crane".equals(s.group) || "tower".equals(s.group) ? 16 : 10)
				.build(key);
			BY_TYPE.put(type, s);
			Registry.register(BuiltInRegistries.ENTITY_TYPE, key, type);
			TYPES.put(s.id, type);
			FabricDefaultAttributeRegistry.register(type, MachineEntity.createAttributes(s));
			if ("tower_crane".equals(s.id)) {
				PLACERS.put(s.id, item("tower_crane_kit", TowerCraneKitItem::new, new Item.Properties().stacksTo(1)));
			} else {
				PLACERS.put(s.id, item(s.id, p -> new MachineItem(p, s.id), new Item.Properties().stacksTo(1)));
			}
		}
		MANUAL = item("machine_manual", ManualItem::new, new Item.Properties().stacksTo(1));

		CreativeModeTab tab = FabricCreativeModeTab.builder()
			.title(Component.translatable("itemGroup.machines"))
			.icon(() -> new ItemStack(PLACERS.get("excavator")))
			.displayItems((params, out) -> {
				PLACERS.values().forEach(out::accept);
				out.accept(CRANE_MAST);
				out.accept(MANUAL);
			})
			.build();
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, ResourceKey.create(Registries.CREATIVE_MODE_TAB, id("machines")), tab);
	}

	private static <T extends Item> T item(String name, Function<Item.Properties, T> factory, Item.Properties props) {
		ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, id(name));
		return Registry.register(BuiltInRegistries.ITEM, key, factory.apply(props.setId(key)));
	}
}
