//
//  ContentView.swift
//  AssetExample
//
//  Created by Artem Novichkov on 29.12.2025.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("Hello, Asset Catalog!")
            Color.brand
            Image(.swift)
            Image(.handThumbsup)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
