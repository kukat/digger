package com.digger

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeDnsAndroidContractTest {
  @Test
  fun cAresReceivesAndroidConnectivityManager() {
    assertEquals(0, NativeDnsAndroid.isInitialized())
  }

  @Test
  fun sharedServiceReturnsControlledIpv4AndIpv6Results() {
    assertNull(NativeDnsContractTestBridge.run())
  }
}
