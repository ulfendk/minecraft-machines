package dk.ulfen.machines.net;

import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.machine.MachineEntity;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/**
 * The operator's controls, sent every tick while a key is held: two bits per channel
 * (1 = +, 2 = -) and a counter that goes up each time Action is pressed.
 */
public record MachineControlPayload(int entityId, int axes, int action) implements CustomPacketPayload {
	public static final Type<MachineControlPayload> TYPE = new Type<>(ModRegistry.id("control"));
	public static final StreamCodec<RegistryFriendlyByteBuf, MachineControlPayload> CODEC = StreamCodec.composite(
		ByteBufCodecs.VAR_INT, MachineControlPayload::entityId,
		ByteBufCodecs.VAR_INT, MachineControlPayload::axes,
		ByteBufCodecs.VAR_INT, MachineControlPayload::action,
		MachineControlPayload::new);

	@Override
	public Type<? extends CustomPacketPayload> type() {
		return TYPE;
	}

	public static void register() {
		PayloadTypeRegistry.serverboundPlay().register(TYPE, CODEC);
		ServerPlayNetworking.registerGlobalReceiver(TYPE, (payload, ctx) -> {
			var player = ctx.player();
			// Only the machine's driver may work it.
			if (player.level().getEntity(payload.entityId()) instanceof MachineEntity m && m.getControllingPassenger() == player) {
				m.applyInput(payload.axes(), payload.action());
			}
		});
	}
}
