package xtmusic.tranxuanthanhtxt.com;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FirebaseAuthenticationPlugin.class);
        this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
            // Add your plugins here
            // Ex: add(TotallyAwesomePlugin.class);
            add(com.getcapacitor.community.facebooklogin.FacebookLoginPlugin.class);
        }});


    }
}
