import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar, Dimensions } from 'react-native';
import { ONBOARDING_SLIDES } from '../constants';

export default function OnboardingScreen({ onDone }) {
  const { width } = Dimensions.get('window');
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const TOTAL = ONBOARDING_SLIDES.length;

  const goTo = (idx) => {
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    setCurrent(idx);
  };

  const handleNext = () => {
    if (current < TOTAL - 1) goTo(current + 1);
    else onDone();
  };

  const slide = ONBOARDING_SLIDES[current];

  return (
    <View style={{ flex:1, backgroundColor:'#071018' }}>
      <StatusBar barStyle="light-content" backgroundColor="#071018" />

      {current < TOTAL - 1 && (
        <TouchableOpacity onPress={onDone}
          style={{ position:'absolute', top:(StatusBar.currentHeight||24)+8,
            right:20, zIndex:10, paddingHorizontal:14, paddingVertical:8 }}>
          <Text style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>Lewati</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          if (idx !== current && idx >= 0 && idx < TOTAL) setCurrent(idx);
        }}
        style={{ flex:1 }}>
        {ONBOARDING_SLIDES.map((sl, i) => (
          <View key={i} style={{ width, alignItems:'center', justifyContent:'center',
            paddingHorizontal:32, paddingTop:60, paddingBottom:140 }}>
            <View style={{ width:150, height:150, borderRadius:75,
              backgroundColor: sl.accent + '18',
              borderWidth:2, borderColor: sl.accent + '35',
              alignItems:'center', justifyContent:'center', marginBottom:36 }}>
              <View style={{ width:100, height:100, borderRadius:50,
                backgroundColor: sl.accent + '28',
                alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontSize:52 }}>{sl.emoji}</Text>
              </View>
            </View>
            <Text style={{ color:'#fff', fontSize:24, fontWeight:'800',
              textAlign:'center', marginBottom:12, lineHeight:32 }}>
              {sl.title}
            </Text>
            <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:15,
              textAlign:'center', marginBottom:32, lineHeight:22 }}>
              {sl.subtitle}
            </Text>
            <View style={{ width:'100%', gap:12 }}>
              {sl.points.map((pt, j) => (
                <View key={j} style={{ flexDirection:'row', alignItems:'center',
                  backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12,
                  paddingHorizontal:16, paddingVertical:12 }}>
                  <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:14, lineHeight:20 }}>
                    {pt}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ position:'absolute', bottom:0, left:0, right:0,
        paddingBottom: Platform.OS==='ios' ? 40 : 32,
        paddingHorizontal:24, alignItems:'center',
        backgroundColor:'rgba(7,16,24,0.9)' }}>
        <View style={{ flexDirection:'row', gap:6, marginBottom:20, marginTop:16 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View style={{
                width: i === current ? 22 : 6,
                height: 6, borderRadius: 3,
                backgroundColor: i === current ? slide.accent : 'rgba(255,255,255,0.18)',
              }} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={handleNext}
          style={{ width:'100%', paddingVertical:16, borderRadius:16,
            backgroundColor: slide.accent, alignItems:'center',
            elevation:6 }}>
          <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>
            {current < TOTAL - 1 ? 'Lanjut  →' : '🚀  Mulai Sekarang'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
