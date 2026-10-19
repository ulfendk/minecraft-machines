package dk.ulfen.machines.client;

import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;
import com.geckolib.renderer.base.GeoRenderState;
import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.machine.MachineEntity;
import dk.ulfen.machines.machine.MachineSpec;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.resources.Identifier;
import org.jspecify.annotations.Nullable;

/** GeckoLib renderer for the machines, scaled like the Bedrock version, with see-through glass. */
public class MachineRenderer<R extends LivingEntityRenderState & GeoRenderState> extends GeoEntityRenderer<MachineEntity, R> {
	private final boolean tall;

	public MachineRenderer(EntityRendererProvider.Context ctx, MachineSpec spec) {
		super(ctx, new DefaultedEntityGeoModel<>(ModRegistry.id(spec.id)));
		this.withScale(spec.scale);
		this.shadowRadius = spec.width * 0.45F;
		this.tall = "crane".equals(spec.group) || "tower".equals(spec.group);
	}

	@Override
	public @Nullable RenderType getRenderType(R renderState, Identifier texture) {
		// glass texels are half transparent; cutout would draw them solid
		if (!renderState.isInvisible) return RenderTypes.entityTranslucent(texture);
		return super.getRenderType(renderState, texture);
	}

	/** Booms and jibs reach far outside the hitbox: keep drawing cranes when their base is off screen. */
	@Override
	protected boolean affectedByCulling(MachineEntity entity) {
		return !tall && super.affectedByCulling(entity);
	}
}
