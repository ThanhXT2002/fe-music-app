package com.tranxuanthanhtxt.MusicApp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.database.sqlite.CapacitorSQLitePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the SQLite plugin
        this.registerPlugin(CapacitorSQLitePlugin.class);
    }
}
