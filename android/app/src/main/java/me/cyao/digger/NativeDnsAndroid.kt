package me.cyao.digger

import android.net.ConnectivityManager

object NativeDnsAndroid {
  @JvmStatic external fun initialize(connectivityManager: ConnectivityManager): Int

  @JvmStatic external fun isInitialized(): Int
}
