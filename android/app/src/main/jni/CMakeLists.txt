cmake_minimum_required(VERSION 3.22)

project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
include(FetchContent)

set(CARES_SHARED OFF CACHE BOOL "" FORCE)
set(CARES_STATIC ON CACHE BOOL "" FORCE)
set(CARES_STATIC_PIC ON CACHE BOOL "" FORCE)
set(CARES_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(CARES_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(CARES_INSTALL OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  cares
  URL https://github.com/c-ares/c-ares/releases/download/v1.34.5/c-ares-1.34.5.tar.gz
  URL_HASH SHA256=7d935790e9af081c25c495fd13c2cfcda4792983418e96358ef6e7320ee06346
)
FetchContent_MakeAvailable(cares)

set(DIGGER_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../..)

target_sources(
  appmodules
  PRIVATE
    ${DIGGER_ROOT}/shared/CaresDnsService.cpp
    ${DIGGER_ROOT}/shared/NativeDnsModule.cpp
)
target_include_directories(appmodules PRIVATE ${DIGGER_ROOT}/shared)
target_link_libraries(appmodules c-ares::cares_static)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  target_sources(
    appmodules
    PRIVATE ${DIGGER_ROOT}/shared/tests/DnsServiceContractScenarios.cpp
  )
  target_compile_definitions(appmodules PRIVATE DIGGER_NATIVE_CONTRACT_TESTS=1)
endif()
