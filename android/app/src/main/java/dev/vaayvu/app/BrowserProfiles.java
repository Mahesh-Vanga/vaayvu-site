package dev.vaayvu.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Profile identifiers are generated locally. The original Personal stores keep their existing names. */
final class BrowserProfiles {
    static final String PERSONAL = "default";
    private final SharedPreferences store;
    private final JSONArray named;
    BrowserProfiles(Context context) {
        store = context.getSharedPreferences("vaayvu-profile-catalog", Context.MODE_PRIVATE);
        JSONArray decoded;
        try { decoded = new JSONArray(store.getString("profiles", "[]")); }
        catch (JSONException e) { decoded = new JSONArray(); }
        named = decoded;
    }
    String active() {
        String id = store.getString("active", PERSONAL);
        return name(id) == null ? PERSONAL : id;
    }
    String name(String id) {
        if (PERSONAL.equals(id)) return "Personal";
        for (int i=0; i<named.length(); i++) {
            JSONObject item = named.optJSONObject(i);
            if (item != null && item.optString("id").equals(id)) return item.optString("name");
        }
        return null;
    }
    boolean select(String id) { return name(id) != null && store.edit().putString("active",id).commit(); }
    String create(String source) {
        String name = source.trim();
        if (name.isEmpty() || name.length() > 60 || name.matches("(?s).*\\p{Cntrl}.*")) throw new IllegalArgumentException("Enter a profile name of up to 60 characters.");
        if (name.equalsIgnoreCase("Personal")) throw new IllegalArgumentException("A profile already uses that name.");
        for (int i=0;i<named.length();i++) {
            JSONObject item = named.optJSONObject(i);
            if (item != null && item.optString("name").equalsIgnoreCase(name)) throw new IllegalArgumentException("A profile already uses that name.");
        }
        String id = UUID.randomUUID().toString();
        try {
            named.put(new JSONObject().put("id",id).put("name",name));
            if (store.edit().putString("profiles",named.toString()).putString("active",id).commit()) return id;
            named.remove(named.length()-1);
        } catch (JSONException ignored) {}
        throw new IllegalArgumentException("Android could not save this profile.");
    }
    JSONArray catalog() {
        JSONArray all = new JSONArray();
        try { all.put(new JSONObject().put("id", PERSONAL).put("name","Personal")); }
        catch (JSONException ignored) {}
        for (int i=0;i<named.length();i++) if (named.optJSONObject(i)!=null) all.put(named.optJSONObject(i));
        return all;
    }
}
