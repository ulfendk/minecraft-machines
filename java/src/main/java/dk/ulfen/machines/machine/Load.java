package dk.ulfen.machines.machine;

import java.util.LinkedHashMap;
import java.util.Map;

import com.mojang.serialization.Codec;

/** What a bucket, blade or bed holds: block/item ids and how many of each, up to a capacity. */
public final class Load {
	public static final Codec<Map<String, Integer>> CODEC = Codec.unboundedMap(Codec.STRING, Codec.INT);

	private final LinkedHashMap<String, Integer> items = new LinkedHashMap<>();
	public final int capacity;

	public Load(int capacity) {
		this.capacity = capacity;
	}

	public int total() {
		int n = 0;
		for (int c : items.values()) n += c;
		return n;
	}

	public boolean isEmpty() {
		return items.isEmpty();
	}

	public boolean isFull() {
		return total() >= capacity;
	}

	public int room() {
		return Math.max(0, capacity - total());
	}

	public void add(String id, int count) {
		if (count > 0) items.merge(id, count, Integer::sum);
	}

	/** Takes one item, oldest kind first; null when empty. */
	public String takeOne() {
		var it = items.entrySet().iterator();
		if (!it.hasNext()) return null;
		var e = it.next();
		String id = e.getKey();
		if (e.getValue() <= 1) it.remove();
		else e.setValue(e.getValue() - 1);
		return id;
	}

	public Map<String, Integer> view() {
		return items;
	}

	public void clear() {
		items.clear();
	}

	public void set(Map<String, Integer> from) {
		items.clear();
		items.putAll(from);
	}

	/** The kind of bulk shown in the bucket: 0 soil, 1 rock, 2 sand (src/diggable.mjs kindOf). */
	public int kind() {
		String most = null;
		int count = -1;
		for (var e : items.entrySet()) if (e.getValue() > count) { most = e.getKey(); count = e.getValue(); }
		return most == null ? 0 : kindOf(most);
	}

	public static int kindOf(String id) {
		String path = id.contains(":") ? id.substring(id.indexOf(':') + 1) : id;
		if (path.matches(".*(sand|gravel|snow|concrete).*")) return 2;
		if (path.matches(".*(cobble|stone|terracotta|basalt|netherrack|andesite|diorite|granite|tuff|calcite|deepslate|dripstone).*")) return 1;
		return 0;
	}
}
